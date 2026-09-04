"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { openUniversalPrintReport } from "@/lib/reports/universal-print-engine";
import { resolveLedgerBranding } from "@/lib/reports/resolve-ledger-branding";
import {
  getLedgerStatement,
  listLedgerReportLedgers,
  type LedgerLookupRow,
  type LedgerStatementLine
} from "@/features/reports/ledger-report/ledger-report-api";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Download,
  Globe,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Building,
  User,
  Layers
} from "lucide-react";
import { Th } from "@/components/ui/translated-th";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import { translateValue } from "@/lib/i18n/table-values";
import { rtlLanguages } from "@/lib/i18n/languages";

type SessionInfo = {
  user: { id: string; email: string | null; fullName: string | null };
  roles: string[];
};

function fmt(n: number) {
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "0.00";
}

export function CountryDetailedLedgerView() {
  const router = useRouter();
  const lang = useActiveLanguage();
  const tr = (label: string) => translateHeader(lang, label);
  const tv = (value: string | null | undefined) => translateValue(lang, value);
  const isRtl = rtlLanguages.includes(lang);

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/erp/auth/session", { credentials: "include" })
      .then((res) => res.json())
      .then((info: SessionInfo) => {
        if (active) setSessionInfo(info);
      })
      .catch(console.error);
    return () => {
      active = false;
    };
  }, []);

  // Date Filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(0);
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);

  // Extra Unified Filters (Branch / User)
  const [filterType, setFilterType] = useState<"none" | "branch" | "user">("none");
  const [filterValue, setFilterValue] = useState("");

  // Data
  const [header, setHeader] = useState<LedgerLookupRow | null>(null);
  const [lines, setLines] = useState<LedgerStatementLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [ledgerOptions, setLedgerOptions] = useState<SearchSelectOption[]>([]);
  const [searchingLedgers, setSearchingLedgers] = useState(false);

  const loadStatement = async (targetLedgerId?: string | null, fDate?: string, tDate?: string) => {
    const ledgerToFetch = targetLedgerId !== undefined ? targetLedgerId : selectedLedgerId;
    if (!ledgerToFetch) return;
    setLoading(true);
    try {
      const res = await getLedgerStatement({
        ledgerId: ledgerToFetch.split(","),
        fromDate: fDate || fromDate,
        toDate: tDate || toDate,
        limit: 2000,
        language: lang
      });
      if (res.found) {
        setHeader(res.header);
        setLines(res.lines || []);
      } else {
        setHeader(null);
        setLines([]);
      }
    } catch (e) {
      console.error("Failed to load statement", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const fetchOptions = async () => {
      setSearchingLedgers(true);
      try {
        const res = await listLedgerReportLedgers({ reportScope: "country", limit: 2000, language: lang });
        if (active && res?.ledgers) {
          const grouped = new Map<string, { label: string; keywords: string; ids: string[] }>();
          for (const row of res.ledgers) {
            const key = row.accountId || row.accountCode || row.ledgerCode || row.ledgerId;
            if (!grouped.has(key)) {
              const code = row.accountCode || row.ledgerCode || "";
              const name = row.accountName || row.ledgerName || "";
              const curr = row.ledgerCurrency || "";
              const comp = row.companyName || "";
              const custNo = row.customerNumber || "";
              const rawCode = row.rawAccountCode || "";
              const refNo = row.manualReferenceNumber || "";
              const bName = row.cityBranchName || row.countryBranchName || "";

              const label = `${code ? code + " — " : ""}${name}${curr ? ` (${curr})` : ""}${comp ? ` • ${comp}` : ""}`;
              const keywords = `${code} ${rawCode} ${refNo} ${custNo} ${name} ${comp} ${curr} ${bName} ${row.accountKind || ""}`;

              grouped.set(key, {
                label,
                keywords,
                ids: []
              });
            }
            grouped.get(key)!.ids.push(row.ledgerId);
          }
          const options = Array.from(grouped.values()).map((g) => ({
            value: g.ids.join(","),
            label: g.label,
            keywords: g.keywords
          }));
          setLedgerOptions(options);

          if (options.length > 0) {
            const currentSelected =
              selectedLedgerId && options.some((o) => o.value === selectedLedgerId)
                ? selectedLedgerId
                : options[0].value;
            setSelectedLedgerId(currentSelected);
            loadStatement(currentSelected);
          }
        }
      } catch (e) {
        console.error("Failed to load ledgers", e);
      } finally {
        if (active) setSearchingLedgers(false);
      }
    };
    fetchOptions();
    return () => {
      active = false;
    };
  }, [lang]);

  const handleApply = () => {
    loadStatement();
  };

  const handleReset = () => {
    if (ledgerOptions.length > 0) {
      setSelectedLedgerId(ledgerOptions[0].value);
      loadStatement(ledgerOptions[0].value);
    } else {
      setSelectedLedgerId(null);
      setHeader(null);
      setLines([]);
    }
    setFilterType("none");
    setFilterValue("");
  };

  const exportCsv = () => {
    if (!calculatedTotals.lines.length) return;
    const headers = ["Date", "Serial", "User", "Branch", "Entry Type", "Ref No", "Description", "Debit", "Credit", "Balance", "USD Rate", "Debit USD", "Credit USD"];
    const rows = calculatedTotals.lines.map((line) => [
      line.entryDate?.split("T")[0] || "",
      line.branchSerialNo || line.countrySerialNo || line.superAdminSerialNo || "",
      line.createdByName || "",
      line.branchName || "",
      line.sourceTable || "",
      line.referenceNo || "",
      `"${(line.description || "").replace(/"/g, '""')}"`,
      line.debit || 0,
      line.credit || 0,
      line.runningBalance || 0,
      line.usdRate || 0,
      line.drUsd || 0,
      line.crUsd || 0
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `country_ledger_${header?.accountCode || "statement"}_${fromDate}_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filterDropdownOptions = useMemo(() => {
    if (filterType === "none" || !lines) return [];
    const values = new Set<string>();
    lines.forEach((line) => {
      if (filterType === "user" && line.createdByName) values.add(line.createdByName);
      if (filterType === "branch" && line.branchName) values.add(line.branchName);
    });
    return Array.from(values)
      .sort()
      .map((v) => ({ label: v, value: v }));
  }, [filterType, lines]);

  const calculatedTotals = useMemo(() => {
    let sumDr = 0;
    let sumCr = 0;
    let sumDrUsd = 0;
    let sumCrUsd = 0;
    let running = 0;

    const filteredLines = lines.filter((line) => {
      if (filterType === "none" || !filterValue) return true;
      if (filterType === "user") return line.createdByName === filterValue;
      if (filterType === "branch") return line.branchName === filterValue;
      return true;
    });

    const mappedLines = filteredLines.map((line) => {
      sumDr += line.debit || 0;
      sumCr += line.credit || 0;
      running += (line.debit || 0) - (line.credit || 0);

      const drUsd = (line.debit || 0) > 0 ? line.usdAmount || 0 : 0;
      const crUsd = (line.credit || 0) > 0 ? line.usdAmount || 0 : 0;

      sumDrUsd += drUsd;
      sumCrUsd += crUsd;

      return {
        ...line,
        runningBalance: running,
        drUsd,
        crUsd
      };
    });

    return {
      lines: mappedLines,
      sumDr,
      sumCr,
      sumDrUsd,
      sumCrUsd,
      running
    };
  }, [lines, filterType, filterValue]);

  async function printDetailedStatement() {
    const openBal = (header as any)?.openingBalance || 0;
    const totalDr = calculatedTotals.sumDr;
    const totalCr = calculatedTotals.sumCr;
    const closingBal = openBal + totalDr - totalCr;

    const brand = await resolveLedgerBranding(header, lang);

    openUniversalPrintReport({
      title: `Account Ledger Statement - ${header?.accountName || "Account"}`,
      subtitle: `${header?.accountCode || ""} • ${header?.countryName || ""} • ${(header as any)?.branchName || (header as any)?.cityBranchName || ""}`,
      lang,
      moduleType: "ledger",
      orientation: "landscape",
      companyInfo: brand.companyInfo,
      scope: {
        scopeLevel: "Country Detailed Ledger Statement",
        company: brand.entityName || undefined,
        country: brand.countryName || header?.countryName || "",
        branch: brand.branchName || (header as any)?.branchName || (header as any)?.cityBranchName || "",
        currency: header?.ledgerCurrency || "AED",
        dateRange: `${fromDate || ""} → ${toDate || ""}`,
      },
      ledgerSummary: {
        accountName: header?.accountName || "Account Holder",
        accountCode: header?.accountCode || "",
        countryBranch: `${header?.countryName || ""} • ${(header as any)?.branchName || (header as any)?.cityBranchName || ""}`,
        currency: header?.ledgerCurrency || "AED",
        datePeriod: `${fromDate || ""} → ${toDate || ""}`,
        openingBalance: openBal,
        openingDcType: openBal >= 0 ? "Dr" : "Cr",
        totalDebit: totalDr,
        totalCredit: totalCr,
        closingBalance: closingBal,
        closingDcType: closingBal >= 0 ? "Dr" : "Cr",
      },
      partyDetails: {
        type: "customer",
        name: header?.accountName || "Account Holder",
        code: header?.accountCode || "",
      },
      columns: [
        { key: "index", label: tr("S.No"), width: "4%", align: "center" },
        { key: "entryDate", label: tr("Date"), format: "date", width: "8%" },
        { key: "serialNo", label: tr("Voucher / Serial #"), width: "10%" },
        { key: "voucherNo", label: tr("Manual Ref"), width: "9%" },
        { key: "sourceModule", label: tr("Source"), width: "8%" },
        { key: "narration", label: tr("Description / Narration"), width: "22%" },
        { key: "currencyExRate", label: tr("Currency / Ex. Rate"), width: "11%" },
        { key: "debit", label: tr("Debit (DR)"), align: "right", format: "currency", width: "10%" },
        { key: "credit", label: tr("Credit (CR)"), align: "right", format: "currency", width: "10%" },
        { key: "runningBalance", label: tr("Balance"), align: "right", format: "currency", width: "10%" },
      ],
      rows: calculatedTotals.lines.map((l, i) => {
        const origCurr = (l as any).origCurrency || (l as any).currency;
        const origAmt = (l as any).origAmount || (l.debit || l.credit || 0);
        const rate = l.usdRate || (l as any).exchangeRate || 1;
        const baseCurr = header?.ledgerCurrency || "AED";

        return {
          index: i + 1,
          entryDate: l.entryDate,
          serialNo: l.branchSerialNo || l.countrySerialNo || l.superAdminSerialNo || "-",
          voucherNo: l.referenceNo || "-",
          sourceModule: l.sourceTable || "Journal",
          narration: l.description || "-",
          origCurrency: origCurr,
          origAmount: origAmt,
          exchangeRate: rate,
          currencyExRate: origCurr && origCurr !== baseCurr ? `${origCurr} ${origAmt} (@ ${rate})` : baseCurr,
          debit: l.debit || 0,
          credit: l.credit || 0,
          runningBalance: l.runningBalance || 0,
          dcType: (l.runningBalance || 0) >= 0 ? "Dr" : "Cr",
          branchName: l.branchName || "-",
        };
      }),
      totals: {
        debit: totalDr,
        credit: totalCr,
        runningBalance: closingBal,
      },
      autoPrint: false,
    });
  }

  return (
    <div className="w-full space-y-4 p-3 sm:p-5 lg:p-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* ── Top Navigation & Page Actions Strip ── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-bold shadow-xs hover:bg-slate-100 dark:hover:bg-slate-800"
              title={tr("Back to previous page")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{tr("Back")}</span>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700 ring-1 ring-inset ring-sky-700/10 dark:bg-sky-950/50 dark:text-sky-300">
                  <Globe className="h-3.5 w-3.5 text-sky-600" />
                  {tr("Country Scope")}
                </span>
                <h1 className="text-base font-black text-slate-900 dark:text-slate-100">
                  {tr("Country Detailed Ledger Statement")}
                </h1>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                {tr("Standard ERP navigation and live country-level ledger statement drill-down")}
              </p>
            </div>
          </div>

          {/* Quick Print / Export Tools */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => { void printDetailedStatement(); }}
              className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-bold shadow-xs"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tr("Print")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={!calculatedTotals.lines.length}
              className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-bold shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tr("Export CSV")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => loadStatement()}
              disabled={loading}
              className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-bold shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{tr("Refresh")}</span>
            </Button>
          </div>
        </div>

        {/* ── Prominent Searchable Account Selector & Filters Bar ── */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {/* Primary Account Combobox */}
          <div className="flex-1 min-w-[280px] max-w-xl">
            <SearchSelect
              label=""
              options={ledgerOptions}
              value={selectedLedgerId ?? ""}
              onValueChange={(v: string) => {
                setSelectedLedgerId(v);
                if (v) {
                  loadStatement(v);
                } else {
                  setHeader(null);
                  setLines([]);
                }
              }}
              placeholder={searchingLedgers ? tr("Loading accounts...") : tr("Search by Account Name, No, Ref, Company, Code...")}
            />
          </div>

          {/* Date range (universal picker) */}
          <div className="min-w-[15rem]">
            <ErpDatePicker
              mode="range"
              lang={lang}
              size="sm"
              value={{ from: fromDate || null, to: toDate || null }}
              onApply={(v) => { setFromDate(v.from ?? ""); setToDate(v.to ?? ""); }}
            />
          </div>

          {/* Filter by Branch / User */}
          <div className="flex items-center gap-1.5">
            <select
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as any);
                setFilterValue("");
              }}
            >
              <option value="none">{tr("Filter By (All)")}</option>
              <option value="branch">{tr("Branch")}</option>
              <option value="user">{tr("User")}</option>
            </select>

            {filterType !== "none" && (
              <div className="w-[160px]">
                <SearchSelect
                  label=""
                  options={filterDropdownOptions}
                  value={filterValue}
                  onValueChange={(v: string) => setFilterValue(v)}
                  placeholder={`Select ${filterType}...`}
                />
              </div>
            )}
          </div>

          {/* Filter Apply & Reset */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleApply}
              disabled={loading}
              className="h-8 gap-1.5 rounded-lg px-3.5 text-xs font-bold shadow-xs bg-sky-600 hover:bg-sky-700 text-white"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              <span>{tr("Apply")}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReset}
              className="h-8 rounded-lg px-3 text-xs font-semibold shadow-xs hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {tr("Reset")}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Top Summary Row (4 Theme-Aligned Cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Account Details */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3 dark:border-slate-800">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-sky-600" />
              <span>{tr("Account Details")}</span>
            </h5>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {header?.ledgerCurrency || "—"}
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("A/c Name")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 text-end truncate">
                {header?.accountName || header?.ledgerName || "—"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("A/c Number")}:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                {header?.accountCode || header?.ledgerCode || "—"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Category")}:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {tv(header?.accountKind) || "—"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Normal Type")}:</span>
              <span className="font-semibold uppercase text-slate-700 dark:text-slate-300">
                {tv(header?.normalBalance) || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Company Details */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3 dark:border-slate-800">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-blue-600" />
              <span>{tr("Company Details")}</span>
            </h5>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Company Name")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 text-end truncate">
                {header?.companyName || "DGT LLC"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Country / City")}:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {header?.countryName || "—"}{header?.cityName ? ` / ${header.cityName}` : ""}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Address")}:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 text-end truncate">
                {header?.address || "—"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Customer No")}:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {header?.customerNumber || header?.manualReferenceNumber || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Branch & Session */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3 dark:border-slate-800">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-violet-600" />
              <span>{tr("Branch & Session Details")}</span>
            </h5>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Branch Name")}:</span>
              <span className="font-bold text-slate-900 dark:text-slate-100 text-end truncate">
                {header?.cityBranchName || header?.countryBranchName || tr("Main Branch")}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Country")}:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {header?.countryName || "—"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("User Name")}:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {sessionInfo?.user?.fullName || "User"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Session Scope")}:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {tr("Country Scoped")}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Ledger Summary & Live Stand */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3 dark:border-slate-800">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-amber-600" />
              <span>{tr("Ledger Summary")}</span>
            </h5>
            <span className="rounded bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
              {calculatedTotals.lines.length} {tr("Entries")}
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Total Debit (Dr)")}:</span>
              <span className="font-bold text-rose-600 dark:text-rose-400">{fmt(calculatedTotals.sumDr)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Total Credit (Cr)")}:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmt(calculatedTotals.sumCr)}</span>
            </div>
            <div className="flex justify-between gap-2 border-t border-slate-100 pt-1 dark:border-slate-800">
              <span className="text-slate-600 dark:text-slate-300 font-bold">{tr("Net Balance")}:</span>
              <span
                className={`font-black text-sm ${
                  calculatedTotals.running < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : calculatedTotals.running > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {fmt(calculatedTotals.running)} {header?.ledgerCurrency || ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Ledger Entries Table Card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              {tr("Ledger Statement & Activity Audit")}
            </h3>
            {header && (
              <span className="text-xs text-slate-400 font-medium hidden md:inline">
                ({header.ledgerCode} • {header.ledgerCurrency})
              </span>
            )}
          </div>
          <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
            {tr("Showing")} {calculatedTotals.lines.length} {tr("Records")}
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                <Th className="p-2.5 whitespace-nowrap text-center font-bold">Date</Th>
                <Th className="p-2.5 whitespace-nowrap text-center font-bold">Serial No</Th>
                <Th className="p-2.5 whitespace-nowrap font-bold">User / Operator</Th>
                <Th className="p-2.5 whitespace-nowrap font-bold">Branch Name</Th>
                <Th className="p-2.5 whitespace-nowrap font-bold">Entry Type</Th>
                <Th className="p-2.5 whitespace-nowrap font-bold">Ref No</Th>
                <Th className="p-2.5 min-w-[200px] font-bold">Description / Particulars</Th>
                <Th className="p-2.5 whitespace-nowrap text-right font-bold text-rose-700 dark:text-rose-400">Debit (Dr)</Th>
                <Th className="p-2.5 whitespace-nowrap text-right font-bold text-emerald-700 dark:text-emerald-400">Credit (Cr)</Th>
                <Th className="p-2.5 whitespace-nowrap text-right font-black">Running Balance</Th>
                <Th className="p-2.5 whitespace-nowrap text-center font-bold">USD Rate</Th>
                <Th className="p-2.5 whitespace-nowrap text-right font-bold text-blue-700 dark:text-blue-400">Dr (USD)</Th>
                <Th className="p-2.5 whitespace-nowrap text-right font-bold text-amber-600 dark:text-amber-400">Cr (USD)</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {calculatedTotals.lines.map((line, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="p-2.5 text-center font-mono whitespace-nowrap text-slate-600 dark:text-slate-400">
                    {line.entryDate?.split("T")[0] || "—"}
                  </td>
                  <td className="p-2.5 text-center font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {line.branchSerialNo || line.countrySerialNo || line.superAdminSerialNo || "—"}
                  </td>
                  <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {line.createdByName || "User"}
                  </td>
                  <td className="p-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {line.branchName || "Main Office"}
                  </td>
                  <td className="p-2.5 whitespace-nowrap">
                    <span className="inline-block rounded px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {line.sourceTable === "ledger_posting_batches"
                        ? tr("Opening Balance")
                        : line.sourceTable === "roznamcha_entries"
                        ? tr("Roznamcha")
                        : tv(line.sourceTable) || "—"}
                    </span>
                  </td>
                  <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {line.referenceNo || "—"}
                  </td>
                  <td className="p-2.5 text-slate-700 dark:text-slate-300 max-w-sm">
                    <div>{line.description || "—"}</div>
                    {((line as any).perKgRate || (line as any).purchaseCurrency || (line as any).totalPurchaseAmount) ? (
                      <div className="text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                        {(line as any).perKgRate && <span>{tr("Per KG Rate")}: {fmt((line as any).perKgRate)}</span>}
                        {(line as any).purchaseCurrency && <span>{tr("Currency")}: {(line as any).purchaseCurrency}</span>}
                        {(line as any).totalPurchaseAmount && <span>{tr("Total")}: {fmt((line as any).totalPurchaseAmount)}</span>}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-2.5 text-right font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    {line.debit ? fmt(line.debit) : "—"}
                  </td>
                  <td className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    {line.credit ? fmt(line.credit) : "—"}
                  </td>
                  <td
                    className={`p-2.5 text-right font-black whitespace-nowrap ${
                      line.runningBalance < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : line.runningBalance > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {fmt(line.runningBalance)}
                  </td>
                  <td className="p-2.5 text-center font-mono text-slate-500 whitespace-nowrap">
                    {line.usdRate ? line.usdRate.toFixed(4) : "—"}
                  </td>
                  <td className="p-2.5 text-right font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    {line.debit ? fmt((line as any).drUsd) : "—"}
                  </td>
                  <td className="p-2.5 text-right font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                    {line.credit ? fmt((line as any).crUsd) : "—"}
                  </td>
                </tr>
              ))}

              {calculatedTotals.lines.length === 0 && !loading && (
                <tr>
                  <td colSpan={13} className="text-center py-10 text-slate-400">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold">{tr("No ledger transactions found for the selected period.")}</p>
                    <p className="text-xs mt-1">{tr("Please choose an account from the search selector above or adjust your date range.")}</p>
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={13} className="text-center py-10 text-slate-500">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    <p className="text-xs font-semibold">{tr("Loading live ledger statement from database...")}</p>
                  </td>
                </tr>
              )}
            </tbody>

            {calculatedTotals.lines.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                  <td colSpan={7} className="p-2.5 text-right uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {tr("Grand Totals")}
                  </td>
                  <td className="p-2.5 text-right font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    {fmt(calculatedTotals.sumDr)}
                  </td>
                  <td className="p-2.5 text-right font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    {fmt(calculatedTotals.sumCr)}
                  </td>
                  <td
                    className={`p-2.5 text-right font-black whitespace-nowrap ${
                      calculatedTotals.running < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : calculatedTotals.running > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {fmt(calculatedTotals.running)}
                  </td>
                  <td className="p-2.5 text-center text-slate-400">—</td>
                  <td className="p-2.5 text-right font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                    {fmt(calculatedTotals.sumDrUsd)}
                  </td>
                  <td className="p-2.5 text-right font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                    {fmt(calculatedTotals.sumCrUsd)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
