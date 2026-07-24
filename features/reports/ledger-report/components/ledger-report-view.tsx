"use client";

import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, MoreVertical, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { ReportPageHeader } from "@/components/reports/report-page-header";
import { ReportFilterBar, type DatePresetKey } from "@/components/reports/report-filter-bar";
import { ReportFilterMenu } from "@/components/reports/report-filter-menu";
import { ReportTd, ReportTh } from "@/components/reports/report-primitives";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { t } from "@/lib/i18n/ui";
import {
  getLedgerStatement,
  listLedgerReportLedgers,
  type LedgerLookupRow,
  type LedgerReportScope,
  type LedgerStatementLine
} from "@/features/reports/ledger-report/ledger-report-api";
import { ProfessionalReportViewer, type ReportColumn } from "@/components/reports/professional-report-viewer";

function fmtNumber(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtRate(value: number) {
  const n = Number.isFinite(value) ? value : 0;
  if (!n) return "-";
  return n.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 });
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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function weekStartIso() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // Monday start
  d.setDate(d.getDate() - diff);
  return d.toISOString().slice(0, 10);
}

function yesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function safeText(value: string | null | undefined) {
  const v = (value ?? "").toString().trim();
  return v ? v : "-";
}

function isNegative(value: number) {
  return Number.isFinite(value) && value < 0;
}

function deriveLedgerBranchName(header: LedgerLookupRow | null) {
  if (!header) return "-";
  return header.cityBranchName || header.countryBranchName || "-";
}

function buildLedgerOption(row: LedgerLookupRow): SearchSelectOption {
  const branch = row.cityBranchName || row.countryBranchName || "";
  const country = row.countryName || "";
  const city = row.cityName || "";
  const account = row.accountName || row.ledgerName || "";
  const accountNo = row.accountCode || row.ledgerCode || "";
  const company = row.companyName || "";

  const label = `${accountNo} - ${account}${branch ? ` (${branch})` : ""}`;
  const keywords = [accountNo, account, company, branch, city, country, row.ledgerCode, row.ledgerName]
    .filter(Boolean)
    .join(" ");

  return { value: row.ledgerId, label, keywords };
}

type SessionInfo = {
  user: { id: string; email: string | null; fullName: string | null };
  roles: string[];
};

async function fetchSessionInfo() {
  return apiGet<SessionInfo>("/api/erp/auth/session");
}

function calcUsdFromLocal(amountLocal: number, usdRate: number) {
  if (!Number.isFinite(amountLocal) || !Number.isFinite(usdRate) || usdRate <= 0) return 0;
  return amountLocal * usdRate;
}

function csvEscape(value: string) {
  const v = (value ?? "").toString();
  if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
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
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const [loadingLedgers, setLoadingLedgers] = useState(true);
  const [ledgers, setLedgers] = useState<LedgerLookupRow[]>([]);
  const [ledgerId, setLedgerId] = useState(initialLedgerId ?? "");

  const [accountNoFilter, setAccountNoFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState<"all" | string>("all");
  const [fromDate, setFromDate] = useState(initialFromDate ?? monthStartIso());
  const [toDate, setToDate] = useState(initialToDate ?? todayIso());
  const [datePreset, setDatePreset] = useState<DatePresetKey>(
    initialFromDate || initialToDate ? "custom" : "this_month"
  );
  const [entrySearch, setEntrySearch] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [printMode, setPrintMode] = useState(false);

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  const canViewConversionColumns = useMemo(() => {
    const roles = (sessionInfo?.roles ?? []).map((role) => String(role).toLowerCase());
    return Boolean(sessionInfo?.scopes?.isSuperAdmin || roles.includes("super_admin"));
  }, [sessionInfo]);

  const [loadingStatement, setLoadingStatement] = useState(false);
  const [header, setHeader] = useState<LedgerLookupRow | null>(null);
  const [lines, setLines] = useState<LedgerStatementLine[]>([]);
  const [totals, setTotals] = useState<{
    entries: number;
    debit: number;
    credit: number;
    balance: number;
    usdDebit: number;
    usdCredit: number;
  } | null>(null);

  // Exchange rate override (preview-only): convert LOCAL -> USD using one rate.
  const [usdRateOverride, setUsdRateOverride] = useState<number | "">("");

  // Client-side table paging (keeps API simple and fast).
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    let cancelled = false;

    fetchSessionInfo()
      .then((info) => {
        if (!cancelled) setSessionInfo(info);
      })
      .catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [reportScope]);

  useEffect(() => {
    if (initialLedgerId) {
      setLedgerId(initialLedgerId);
    }
  }, [initialLedgerId]);

  // Load ledgers (supports server-side search via `q`).
  useEffect(() => {
    let cancelled = false;
    const query = accountNoFilter.trim();

    const handle = setTimeout(() => {
      (async () => {
        try {
          setLoadingLedgers(true);
          const res = await listLedgerReportLedgers({ reportScope, q: query || null, limit: 500 });
          if (!cancelled) setLedgers(res.ledgers ?? []);
        } finally {
          if (!cancelled) setLoadingLedgers(false);
        }
      })().catch(() => {
        if (!cancelled) setLoadingLedgers(false);
      });
    }, query ? 250 : 0);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [accountNoFilter, reportScope]);

  // Date presets (quick filter).
  useEffect(() => {
    if (datePreset === "custom") return;

    const today = todayIso();
    if (datePreset === "today") {
      setFromDate(today);
      setToDate(today);
      return;
    }

    if (datePreset === "yesterday") {
      const y = yesterdayIso();
      setFromDate(y);
      setToDate(y);
      return;
    }

    if (datePreset === "this_week") {
      setFromDate(weekStartIso());
      setToDate(today);
      return;
    }

    if (datePreset === "this_month") {
      setFromDate(monthStartIso());
      setToDate(today);
      return;
    }
  }, [datePreset]);

  // Close the action menu when clicking outside or pressing escape.
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

  const branchOptions = useMemo(() => {
    const pairs = new Map<string, string>();
    for (const row of ledgers) {
      const id = row.cityBranchId || row.countryBranchId;
      const name = row.cityBranchName || row.countryBranchName;
      if (id && name) pairs.set(id, name);
    }
    return Array.from(pairs.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ledgers]);

  const filteredLedgers = useMemo(() => {
    return ledgers.filter((row) => {
      if (branchFilter !== "all") {
        const id = row.cityBranchId || row.countryBranchId;
        if (id !== branchFilter) return false;
      }
      return true;
    });
  }, [branchFilter, ledgers]);

  const ledgerOptions: SearchSelectOption[] = useMemo(() => filteredLedgers.map(buildLedgerOption), [filteredLedgers]);

  const accountNoOptions: SearchSelectOption[] = useMemo(() => {
    const map = new Map<string, { code: string; account: string; company: string; branch: string; country: string; city: string }>();
    for (const row of ledgers) {
      const code = (row.accountCode || row.ledgerCode || "").trim();
      if (!code) continue;
      if (!map.has(code)) {
        map.set(code, {
          code,
          account: row.accountName || row.ledgerName || "",
          company: row.companyName || "",
          branch: row.cityBranchName || row.countryBranchName || "",
          country: row.countryName || "",
          city: row.cityName || ""
        });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((item) => ({
        value: item.code,
        label: `${item.code}${item.account ? ` - ${item.account}` : ""}`,
        keywords: [item.code, item.account, item.company, item.branch, item.city, item.country].filter(Boolean).join(" ")
      }));
  }, [ledgers]);

  const branchFilterOptions: SearchSelectOption[] = useMemo(() => {
    return [{ value: "all", label: t(lang, "ledger.all_branches"), keywords: t(lang, "ledger.all_branches") }].concat(
      branchOptions.map((b) => ({
        value: b.id,
        label: b.name,
        keywords: `${b.name} ${b.name.toLowerCase().includes("city") ? "city" : ""} ${b.name.toLowerCase().includes("main") ? "main" : ""}`
      }))
    );
  }, [branchOptions, lang]);

  const datePresetOptions: SearchSelectOption[] = useMemo(
    () => [
      { value: "today", label: t(lang, "ledger.preset_today"), keywords: t(lang, "ledger.preset_today") },
      { value: "yesterday", label: t(lang, "ledger.preset_yesterday"), keywords: t(lang, "ledger.preset_yesterday") },
      { value: "this_week", label: t(lang, "ledger.preset_this_week"), keywords: t(lang, "ledger.preset_this_week") },
      { value: "this_month", label: t(lang, "ledger.preset_this_month"), keywords: t(lang, "ledger.preset_this_month") },
      { value: "custom", label: t(lang, "ledger.preset_custom"), keywords: t(lang, "ledger.preset_custom") }
    ],
    [lang]
  );

  const selectedLedger = useMemo(() => ledgers.find((l) => l.ledgerId === ledgerId) ?? null, [ledgers, ledgerId]);

  const filteredLines = useMemo(() => {
    const q = entrySearch.trim().toLowerCase();
    if (!q) return lines;

    return lines.filter((row) => {
      const hay = [
        row.entryDate,
        row.referenceNo,
        row.description,
        row.createdByName,
        row.createdById,
        row.currency,
        row.sourceTable,
        row.sourceId
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [entrySearch, lines]);

  const tableRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredLines.slice(start, end);
  }, [filteredLines, page]);

  const pageCount = Math.max(1, Math.ceil(filteredLines.length / pageSize));

  const effectiveUsdRateForDisplay = useMemo(() => {
    if (usdRateOverride === "" || !Number.isFinite(Number(usdRateOverride)) || Number(usdRateOverride) <= 0) {
      // When no override, show "transaction-time" conversion (per row).
      return null;
    }
    return Number(usdRateOverride);
  }, [usdRateOverride]);

  const displayTotals = useMemo(() => {
    if (!header) return null;

    const creditNormal = header.normalBalance === "credit";

    let debit = 0;
    let credit = 0;
    let usdDebit = 0;
    let usdCredit = 0;
    let usdBalance = 0;

    for (const row of filteredLines) {
      debit += row.debit;
      credit += row.credit;

      const txRate = row.usdRate || 1;
      const rate = effectiveUsdRateForDisplay ?? txRate;
      const amountLocal = row.debit > 0 ? row.debit : row.credit;

      const amountUsd =
        effectiveUsdRateForDisplay !== null
          ? calcUsdFromLocal(amountLocal, rate)
          : row.usdAmount > 0
            ? row.usdAmount
            : calcUsdFromLocal(amountLocal, txRate);

      const debitUsd = row.debit > 0 ? amountUsd : 0;
      const creditUsd = row.credit > 0 ? amountUsd : 0;

      usdDebit += debitUsd;
      usdCredit += creditUsd;
      usdBalance += creditNormal ? creditUsd - debitUsd : debitUsd - creditUsd;
    }

    const balance = filteredLines.length ? filteredLines[filteredLines.length - 1]!.runningBalance : 0;

    return {
      entries: filteredLines.length,
      debit,
      credit,
      balance,
      usdDebit,
      usdCredit,
      usdBalance
    };
  }, [effectiveUsdRateForDisplay, filteredLines, header]);

  const lastLine = useMemo(() => {
    return filteredLines.length ? filteredLines[filteredLines.length - 1]! : null;
  }, [filteredLines]);

  const lastTransactionDate = lastLine?.entryDate ?? "-";
  const lastReferenceNo = lastLine?.referenceNo ?? null;
  const lastUserLabel = lastLine?.createdByName ?? null;

  useEffect(() => {
    // keep paging consistent when filtering
    setPage(1);
  }, [entrySearch, ledgerId]);

  function resetReport() {
    setLedgerId("");
    setHeader(null);
    setLines([]);
    setTotals(null);
    setUsdRateOverride("");
    setFromDate(monthStartIso());
    setToDate(todayIso());
    setPage(1);
  }

  async function applyReport() {
    if (!ledgerId) return;
    setLoadingStatement(true);
    try {
      const res = await getLedgerStatement({ ledgerId, fromDate, toDate, limit: 2000 });
      setHeader(res.header);
      setLines(res.lines ?? []);
      setTotals(res.totals ?? null);
      setPage(1);

      // Set a sensible default override from the latest transaction rate (optional).
      // Override is preview-only; transaction-time rates are still visible in the table.
      if (res.lines?.length) {
        const lastRate = res.lines[res.lines.length - 1]?.usdRate ?? 0;
        if (lastRate > 0) setUsdRateOverride(lastRate);
      }
    } finally {
      setLoadingStatement(false);
    }
  }

  useEffect(() => {
    if (!ledgerId) return;
    applyReport().catch(() => null);

    const handleSaved = () => {
      if (ledgerId) {
        applyReport().catch(() => null);
      }
    };

    window.addEventListener("erp:posting-saved", handleSaved);
    window.addEventListener("erp:posting-deleted", handleSaved);
    return () => {
      window.removeEventListener("erp:posting-saved", handleSaved);
      window.removeEventListener("erp:posting-deleted", handleSaved);
    };
  }, [ledgerId]);

  const balanceTone = displayTotals?.balance
    ? isNegative(displayTotals.balance)
      ? "text-red-600"
      : "text-emerald-600"
    : "text-muted-foreground";

  const ledgerCurrency = header?.ledgerCurrency || selectedLedger?.ledgerCurrency || "-";

  function exportCsv() {
    if (!header) return;

    const creditNormal = header.normalBalance === "credit";
    const branchName = deriveLedgerBranchName(header);
    let runningUsd = 0;

    const rows = lines.map((row) => {
      const txRate = row.usdRate || 1;
      const rate = effectiveUsdRateForDisplay ?? txRate;

      const debitUsd =
        effectiveUsdRateForDisplay !== null
          ? calcUsdFromLocal(row.debit, rate)
          : row.debit > 0
            ? row.usdAmount > 0
              ? row.usdAmount
              : calcUsdFromLocal(row.debit, txRate)
            : 0;

      const creditUsd =
        effectiveUsdRateForDisplay !== null
          ? calcUsdFromLocal(row.credit, rate)
          : row.credit > 0
            ? row.usdAmount > 0
              ? row.usdAmount
              : calcUsdFromLocal(row.credit, txRate)
            : 0;

      runningUsd += creditNormal ? creditUsd - debitUsd : debitUsd - creditUsd;

      const rowValues = [
        branchName,
        row.entryDate,
        row.sourceId.slice(0, 8),
        row.createdByName || (row.createdById ? row.createdById.slice(0, 8) : ""),
        row.referenceNo ?? "",
        row.sourceTable === "roznamcha_entries" ? t(lang, "ledger.source_roznamcha") : t(lang, "ledger.source_ledger"),
        row.description ?? "",
        row.debit ? String(row.debit) : "",
        row.credit ? String(row.credit) : "",
        String(row.runningBalance)
      ];

      if (canViewConversionColumns) {
        rowValues.push(
          String(rate),
          debitUsd ? String(debitUsd) : "",
          creditUsd ? String(creditUsd) : "",
          String(runningUsd)
        );
      }

      return rowValues;
    });

    const headerRow = [
      "Branch",
      "Date",
      "Serial",
      "User",
      "Roz#",
      "Source",
      "Details",
      "Debit",
      "Credit",
      "Running Balance",
      ...(canViewConversionColumns ? ["Exchange Rate", "Debit USD", "Credit USD", "Running USD"] : [])
    ];

    const csv = [headerRow, ...rows]
      .map((r) => r.map((c) => csvEscape(String(c ?? ""))).join(","))
      .join("\r\n");

    const file = `ledger-report_${header.ledgerCode}_${fromDate}_to_${toDate}.csv`.replace(/[^\w.-]+/g, "_");
    downloadTextFile(file, csv, "text/csv");
  }

  return (
    <div className="space-y-4">
      <ReportPageHeader
        title={pageTitle}
        subtitle={t(lang, "ledger.report_subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative" ref={actionsRef}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t(lang, "ledger.actions")}
                onClick={() => setActionsOpen((v) => !v)}
                disabled={!header || loadingStatement}
              >
                <MoreVertical className="h-4 w-4" aria-hidden />
              </Button>

              {actionsOpen ? (
                <div className="absolute right-0 top-full z-20 mt-2 w-44 overflow-hidden rounded-lg border bg-background shadow-lg">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => {
                      setActionsOpen(false);
                      window.print();
                    }}
                  >
                    <Printer className="h-4 w-4" aria-hidden />
                    {t(lang, "ledger.print")}
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => {
                      setActionsOpen(false);
                      exportCsv();
                    }}
                  >
                    <DownloadActionIcon className="h-4 w-4" aria-hidden />
                    {t(lang, "ledger.export_csv")}
                  </button>
                </div>
              ) : null}
            </div>

            <ReportFilterMenu ariaLabel={t(lang, "ledger.filters")} disabled={loadingLedgers}>
              <div className="border-b bg-muted/10 px-3 py-2 text-sm font-semibold">{t(lang, "ledger.filters")}</div>
              <div className="space-y-3 p-3">
                <ReportFilterBar
                  accountNoLabel={t(lang, "ledger.filter_account_no")}
                  accountNoValue={accountNoFilter}
                  accountNoOptions={accountNoOptions}
                  onAccountNoChange={(code) => {
                    setAccountNoFilter(code);
                    const matches = ledgers.filter((row) => (row.accountCode || row.ledgerCode || "").trim() === code);
                    if (matches.length === 1) setLedgerId(matches[0].ledgerId);
                  }}
                  ledgerLabel={t(lang, "ledger.select_account")}
                  ledgerValue={ledgerId}
                  ledgerOptions={ledgerOptions}
                  onLedgerChange={(v) => setLedgerId(v)}
                  datePresetLabel={t(lang, "ledger.date_preset")}
                  datePresetValue={datePreset}
                  datePresetOptions={datePresetOptions}
                  onDatePresetChange={setDatePreset}
                  branchLabel={t(lang, "ledger.branch_filter")}
                  branchValue={branchFilter}
                  branchOptions={branchFilterOptions}
                  onBranchChange={(v) => setBranchFilter(v as any)}
                  disabled={loadingLedgers}
                />

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{t(lang, "ledger.from_date")}</Label>
                    <Input
                      className="h-9 text-xs"
                      type="date"
                      value={fromDate}
                      onChange={(e) => {
                        setDatePreset("custom");
                        setFromDate(e.target.value);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">{t(lang, "ledger.to_date")}</Label>
                    <Input
                      className="h-9 text-xs"
                      type="date"
                      value={toDate}
                      onChange={(e) => {
                        setDatePreset("custom");
                        setToDate(e.target.value);
                      }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <Button type="button" size="sm" disabled={!ledgerId || loadingStatement} onClick={() => applyReport()}>
                    {loadingStatement ? t(lang, "ledger.loading") : t(lang, "ledger.apply")}
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={resetReport} disabled={loadingStatement}>
                    {t(lang, "ledger.reset")}
                  </Button>
                </div>
              </div>
            </ReportFilterMenu>
          </div>
        }
      />

      {/* Top Row Details */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t(lang, "ledger.report_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {/* Account Details */}
            <div className="space-y-2">
              <h3 className="border-b pb-1 text-xs font-semibold text-foreground">{t(lang, "ledger.account_details")}</h3>
              <div className="space-y-1 text-xs">
                <KV k={t(lang, "ledger.economic_name")} v={safeText(header?.ledgerName)} />
                <KV k={t(lang, "ledger.category")} v={fmtKind(header?.accountKind)} />
                <KV k={t(lang, "ledger.account_title")} v={"-"} />
                <KV k={t(lang, "ledger.account_type")} v={"-"} />
                <KV k={t(lang, "ledger.currency")} v={safeText(ledgerCurrency)} />
                <KV k={t(lang, "ledger.contract_no")} v={"-"} />
                <KV k={t(lang, "ledger.contract_date")} v={"-"} />
                <KV k={t(lang, "ledger.contract_type")} v={"-"} />
              </div>
            </div>

            {/* Company Details */}
            <div className="space-y-2">
              <h3 className="border-b pb-1 text-xs font-semibold text-foreground">{t(lang, "ledger.company_details")}</h3>
              <div className="space-y-1 text-xs">
                <KV k={t(lang, "ledger.company_name")} v={safeText(header?.companyName)} />
                <KV k={t(lang, "ledger.business_title")} v={"-"} />
                <KV k={t(lang, "ledger.registration_number")} v={"-"} />
                <KV k={t(lang, "ledger.trn")} v={"-"} />
                <KV k={t(lang, "ledger.website")} v={"-"} />
              </div>
            </div>

            {/* Branch Details */}
            <div className="space-y-2">
              <h3 className="border-b pb-1 text-xs font-semibold text-foreground">{t(lang, "ledger.branch_details")}</h3>
              <div className="space-y-1 text-xs">
                <KV k={t(lang, "ledger.branch_name")} v={safeText(deriveLedgerBranchName(header))} />
                <KV k={t(lang, "ledger.branch_account_no")} v={safeText(header?.cityBranchId || header?.countryBranchId)} />
                <KV k={t(lang, "ledger.country")} v={safeText(header?.countryName)} />
                <KV k={t(lang, "ledger.state_city")} v={[header?.stateName, header?.cityName].filter(Boolean).join(" / ") || "-"} />
                <KV k={t(lang, "ledger.address")} v={safeText(header?.address)} />
              </div>
            </div>

            {/* Ledger Summary */}
            <div className="space-y-2">
              <h3 className="border-b pb-1 text-xs font-semibold text-foreground">{t(lang, "ledger.summary")}</h3>
              <div className="space-y-1 text-xs">
                <KV k={t(lang, "ledger.entries")} v={displayTotals ? String(displayTotals.entries) : "-"} />
                <KV
                  k={t(lang, "ledger.total_debit")}
                  v={displayTotals ? fmtNumber(displayTotals.debit) : "-"}
                  tone="text-red-600"
                />
                <KV
                  k={t(lang, "ledger.total_credit")}
                  v={displayTotals ? fmtNumber(displayTotals.credit) : "-"}
                  tone="text-emerald-600"
                />
                <KV
                  k={t(lang, "ledger.current_balance")}
                  v={displayTotals ? fmtNumber(displayTotals.balance) : "-"}
                  tone={balanceTone}
                />
                <KV k={t(lang, "ledger.last_transaction")} v={lastTransactionDate} />
                <KV k={t(lang, "ledger.last_reference")} v={safeText(lastReferenceNo)} />
                <KV k={t(lang, "ledger.user_name")} v={safeText(lastUserLabel)} />
                <KV k={t(lang, "ledger.normal_balance")} v={fmtKind(header?.normalBalance)} />
                <KV k={t(lang, "ledger.ledger_scope")} v={fmtKind(header?.scope)} />
                <KV k={t(lang, "ledger.ledger_status")} v={header ? "Active" : "-"} />

                <div className="mt-2 space-y-1">
                  <Label className="text-[11px] text-muted-foreground">{t(lang, "ledger.exchange_rate_local_to_usd")}</Label>
                  <Input
                    type="number"
                    step="0.00000001"
                    min={0}
                    className="h-9 text-xs"
                    value={usdRateOverride}
                    onChange={(e) => setUsdRateOverride(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder={t(lang, "ledger.exchange_rate_ph")}
                  />
                  <p className="text-[11px] text-muted-foreground">{t(lang, "ledger.exchange_rate_hint")}</p>
                </div>
              </div>
            </div>

            {/* Session / Login Details */}
            <div className="space-y-2">
              <h3 className="border-b pb-1 text-xs font-semibold text-foreground">{t(lang, "ledger.session_details")}</h3>
              <div className="space-y-1 text-xs">
                <KV k={t(lang, "ledger.session_branch")} v={safeText(deriveLedgerBranchName(header))} />
                <KV k={t(lang, "ledger.user_name")} v={safeText(sessionInfo?.user.fullName || sessionInfo?.user.email)} />
                <KV k={t(lang, "ledger.user_id")} v={safeText(sessionInfo?.user.id)} />
                <KV k={t(lang, "ledger.roles")} v={sessionInfo?.roles?.length ? sessionInfo.roles.join(", ") : "-"} />
              </div>
            </div>

            {/* Filters moved to compact top filter menu */}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mt-4 mb-2">
        <h2 className="text-lg font-semibold">{t(lang, "ledger.entries_table_title")}</h2>
        <Button variant="outline" size="sm" onClick={() => setPrintMode(true)} className="gap-2">
          <Printer className="h-4 w-4" />
          Print Preview
        </Button>
      </div>

      {/* Ledger Entries */}
      {(() => {
        if (!header) return null;

        const columns: ReportColumn<LedgerStatementLine>[] = [
          { key: "index", header: "SR#", width: "40px", align: "center", render: (_, idx) => (page - 1) * pageSize + idx + 1 },
          { key: "entryDate", header: "Date", align: "center", width: "80px" },
          { key: "sourceId", header: "Voucher No.", align: "center", render: (r) => r.sourceId.slice(0, 8) },
          { key: "referenceNo", header: "Manual Bill No.", align: "center", render: (r) => safeText(r.referenceNo) },
          { key: "sourceTable", header: "System Bill No.", align: "center", render: (r) => r.sourceTable === "roznamcha_entries" ? t(lang, "ledger.source_roznamcha") : t(lang, "ledger.source_ledger") },
          { key: "countryName", header: "Country", width: "100px", render: () => header.countryName || "-" },
          { key: "branch", header: "Branch", width: "100px", render: () => deriveLedgerBranchName(header) },
          { key: "cityBranch", header: "City Branch", width: "100px", render: () => header.cityBranchName || "-" },
          { key: "user", header: "User", render: (r) => safeText(r.createdByName || (r.createdById ? r.createdById.slice(0, 8) : "")) },
          { key: "accountCode", header: "Account Code", align: "center", render: () => header.accountCode || header.ledgerCode },
          { key: "accountName", header: "Account Name", render: () => header.accountName || header.ledgerName },
          { key: "description", header: "Narration", render: (r) => safeText(r.description) },
          { key: "debit", header: "Debit", align: "right", render: (r) => fmtNumber(r.debit) },
          { key: "credit", header: "Credit", align: "right", render: (r) => fmtNumber(r.credit) },
          { key: "runningBalance", header: "Running Balance", align: "right", render: (r) => fmtNumber(r.runningBalance) },
          { key: "currency", header: "Currency", align: "center", render: () => header.ledgerCurrency || "-" },
          ...(canViewConversionColumns ? ([
            {
              key: "usdRate",
              header: "Exchange Rate",
              align: "right",
              render: (r: LedgerStatementLine) => fmtRate(effectiveUsdRateForDisplay ?? r.usdRate || 1)
            },
            {
              key: "finalAmount",
              header: "Final Amount",
              align: "right",
              render: (r: LedgerStatementLine) => {
                const rate = effectiveUsdRateForDisplay ?? r.usdRate || 1;
                const usdAmount = r.debit > 0 ? (r.usdAmount > 0 ? r.usdAmount : r.debit / rate) : (r.credit > 0 ? (r.usdAmount > 0 ? r.usdAmount : r.credit / rate) : 0);
                return fmtNumber(usdAmount);
              }
            }
          ] as ReportColumn<LedgerStatementLine>[]) : [])
        ];

        return (
          <>
            <div className="w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
              <table className="w-full min-w-[1200px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900">
                    {columns.map((c) => (
                      <th key={c.key} className={cn("whitespace-nowrap px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500", c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "")}>
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {filteredLines.slice((page - 1) * pageSize, page * pageSize).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      {columns.map((c) => (
                        <td key={c.key} className={cn("whitespace-nowrap px-4 py-3 align-middle text-[11px] font-medium text-slate-700 dark:text-slate-300", c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "")}>
                          {c.render ? c.render(row, idx) : (row as any)[c.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {filteredLines.length === 0 && !loadingStatement && (
                    <tr>
                      <td colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                        {t(lang, "ledger.no_entries_found")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-2 py-3 text-xs text-slate-500">
              <span>{`Showing ${filteredLines.length ? (page - 1) * pageSize + 1 : 0} to ${Math.min(page * pageSize, filteredLines.length)} of ${filteredLines.length} entries`}</span>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" className="h-7 text-slate-600 hover:text-slate-900" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                  Prev
                </Button>
                <div className="text-xs">
                  Page <b className="text-slate-800">{page}</b> / {Math.max(1, Math.ceil(filteredLines.length / pageSize))}
                </div>
                <Button type="button" variant="outline" size="sm" className="h-7 text-slate-600 hover:text-slate-900" disabled={page >= Math.ceil(filteredLines.length / pageSize)} onClick={() => setPage(p => Math.min(Math.ceil(filteredLines.length / pageSize), p + 1))}>
                  Next
                </Button>
              </div>
            </div>

            {printMode && typeof document !== 'undefined' && createPortal(
              <div className="fixed inset-0 z-[100] bg-black/80 flex flex-col">
                <div className="flex-1 overflow-hidden">
                  <ProfessionalReportViewer
                    lang={lang}
                    title={t(lang, "ledger.entries_table_title")}
                    data={filteredLines}
                    columns={columns}
                    filters={{
                      "Account No": header.accountCode || header.ledgerCode,
                      "Account Name": header.accountName || header.ledgerName,
                      Country: header.countryName,
                      Branch: deriveLedgerBranchName(header),
                      Currency: ledgerCurrency,
                      "Date From": fromDate,
                      "Date To": toDate,
                    }}
                    summary={{
                      totalDebit: displayTotals?.debit || 0,
                      totalCredit: displayTotals?.credit || 0,
                      balance: displayTotals?.balance || 0,
                      totalTransactions: filteredLines.length,
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
  );
}

function KV({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-[110px] text-[11px] text-muted-foreground">{k}:</div>
      <div className={cn("text-xs font-semibold text-foreground", tone)}>{v}</div>
    </div>
  );
}
