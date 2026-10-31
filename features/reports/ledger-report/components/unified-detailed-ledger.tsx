"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { openLedgerStatementPrint, type LedgerPrintOrientation } from "@/lib/reports/ledger-statement-print";
import { t as centralT } from "@/lib/i18n/ui";
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
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Building,
  User,
  Layers,
  ShieldCheck
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

export function UnifiedDetailedLedgerView() {
  const router = useRouter();
  const lang = useActiveLanguage();
  const tr = (label: string) => translateHeader(lang, label);
  const tv = (value: string | null | undefined) => translateValue(lang, value);
  const isRtl = rtlLanguages.includes(lang);

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/erp/auth/session", { credentials: "include" })
      .then((res) => res.json())
      .then((body: { ok?: boolean; data?: SessionInfo }) => {
        const info = body?.data ?? null;
        if (active) {
          setSessionInfo(info);
          setIsSuperAdmin(info?.roles?.includes("super_admin") || false);
        }
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

  // Extra Unified Filters (Country / Branch / User)
  const [filterType, setFilterType] = useState<"none" | "country" | "branch" | "user">("none");
  const [filterValue, setFilterValue] = useState("");

  // Data
  const [header, setHeader] = useState<LedgerLookupRow | null>(null);
  const [lines, setLines] = useState<LedgerStatementLine[]>([]);
  // balance before fromDate (server-computed, on the account's normal side) — the running balance starts here
  const [openingBalance, setOpeningBalance] = useState(0);
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
        setOpeningBalance(Number(res.totals?.openingBalance ?? 0) || 0);
      } else {
        setHeader(null);
        setLines([]);
        setOpeningBalance(0);
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
        const res = await listLedgerReportLedgers({
          reportScope: isSuperAdmin ? "super_admin" : "country",
          limit: 2000,
          language: lang
        });
        if (active && res?.ledgers) {
          const grouped = new Map<string, { label: string; keywords: string; ids: string[]; name: string; code: string; comp: string; cName: string; bName: string; phone: string; email: string; address: string; kind: string }>();
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
              const cName = row.countryName || "";
              const bName = row.cityBranchName || row.countryBranchName || "";
              const phone = row.contacts?.mobile || row.contacts?.phone || "";
              const email = row.contacts?.email || "";
              const address = row.address || [row.cityName, bName, cName].filter(Boolean).join(", ");
              const kind = row.accountKind || "Ledger Account";

              const label = `${code ? code + " — " : ""}${name}${curr ? ` (${curr})` : ""}${comp ? ` • ${comp}` : ""}`;
              const keywords = `${code} ${rawCode} ${refNo} ${custNo} ${name} ${comp} ${curr} ${cName} ${bName} ${kind} ${phone} ${email} ${address}`;

              grouped.set(key, {
                label,
                keywords,
                ids: [],
                name,
                code,
                comp,
                cName,
                bName,
                phone,
                email,
                address,
                kind
              });
            }
            grouped.get(key)!.ids.push(row.ledgerId);
          }
          const options = Array.from(grouped.values()).map((g) => ({
            value: g.ids.join(","),
            label: g.label,
            keywords: g.keywords,
            primaryText: g.name,
            code: g.code,
            companyName: g.comp || undefined,
            category: g.kind,
            phone: g.phone || undefined,
            email: g.email || undefined,
            address: g.address || undefined,
            branch: g.bName || undefined,
            country: g.cName || undefined,
            status: "Active",
            isAccountCard: true
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
  }, [lang, isSuperAdmin]);

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
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ledger_${header?.accountCode || "statement"}_${fromDate}_${toDate}.csv`);
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
      if (filterType === "country" && header?.countryName) values.add(header.countryName);
    });
    return Array.from(values)
      .sort()
      .map((v) => ({ label: v, value: v }));
  }, [filterType, lines, header]);

  const calculatedTotals = useMemo(() => {
    let sumDr = 0;
    let sumCr = 0;
    let sumDrUsd = 0;
    let sumCrUsd = 0;
    let running = openingBalance;
    const creditNormal = header?.normalBalance === "credit";

    const filteredLines = lines.filter((line) => {
      if (filterType === "none" || !filterValue) return true;
      if (filterType === "user") return line.createdByName === filterValue;
      if (filterType === "branch") return line.branchName === filterValue;
      if (filterType === "country") return header?.countryName === filterValue;
      return true;
    });

    const mappedLines = filteredLines.map((line) => {
      sumDr += line.debit || 0;
      sumCr += line.credit || 0;
      running += creditNormal ? (line.credit || 0) - (line.debit || 0) : (line.debit || 0) - (line.credit || 0);

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
  }, [lines, filterType, filterValue, header, openingBalance]);

  const rawContacts = (header as any)?.contacts;
  const parsedContacts = useMemo<Array<{ type?: string; value?: string }>>(() => {
    if (!rawContacts) return [];
    if (Array.isArray(rawContacts)) return rawContacts;
    if (typeof rawContacts === "string") {
      try { return JSON.parse(rawContacts); } catch { return []; }
    }
    return [];
  }, [rawContacts]);

  const pickContact = useCallback((types: string[]) => {
    return parsedContacts.find((c) => types.includes(String(c?.type || "").toLowerCase()) && String(c?.value || "").trim())?.value?.trim() || null;
  }, [parsedContacts]);

  async function printStatement(orientation: LedgerPrintOrientation) {
    if (!header) return;
    const printedBy = sessionInfo?.user?.fullName || sessionInfo?.user?.email || null;
    const brand = await resolveLedgerBranding(header, lang, printedBy);
    const filtered = filterType !== "none" && filterValue;

    const rawContacts = (header as any).contacts;
    let parsedContacts: Array<{ type?: string; value?: string }> = [];
    if (Array.isArray(rawContacts)) parsedContacts = rawContacts;
    else if (typeof rawContacts === "string") {
      try {
        parsedContacts = JSON.parse(rawContacts);
      } catch {
        parsedContacts = [];
      }
    }
    const pickContact = (types: string[]) =>
      parsedContacts.find((c) => types.includes(String(c?.type || "").toLowerCase()) && String(c?.value || "").trim())?.value?.trim() || null;

    const phone = (header as any).accountPhone || pickContact(["mobile", "phone", "landline", "office"]) || null;
    const whatsapp = pickContact(["whatsapp"]) || (header as any).accountPhone || null;
    const email = (header as any).accountEmail || pickContact(["email"]) || null;
    const openedDate = header.createdAt ? header.createdAt.slice(0, 10) : null;
    const finalAddress = (header as any).accountAddress || header.address || null;
    const branchName = brand.branchName || header.cityBranchName || header.countryBranchName || null;
    const branchCode = (header as any).branchCode || (header as any).cityBranchCode || (header as any).countryBranchCode || null;
    const countryName = brand.countryName || header.countryName || null;
    const countryCode = (header as any).countryCode || (countryName ? countryName.slice(0, 3).toUpperCase() : null);
    const stateProvince = (header as any).stateName || null;
    const city = (header as any).cityName || null;
    const category = header.accountKind ? tv(header.accountKind) : null;

    openLedgerStatementPrint(
      {
        company: brand.companyInfo,
        account: {
          name: header.accountName || header.ledgerName || "—",
          code: header.accountCode || header.ledgerCode || "",
          customerNumber: header.customerNumber ?? null,
          manualReference: header.manualReferenceNumber ?? null,
          kind: header.accountKind ? tv(header.accountKind) : null,
          category,
          currency: header.ledgerCurrency || "",
          openedDate,
          branchName,
          branchCode,
          countryCode,
          country: countryName,
          stateProvince,
          city,
          finalAddress,
          address: finalAddress,
          phone,
          whatsapp,
          email,
          branch: branchName,
          company: header.companyName,
        },
        normalBalance: header.normalBalance === "credit" ? "credit" : "debit",
        fromDate,
        toDate,
        openingBalance,
        totalDebit: calculatedTotals.sumDr,
        totalCredit: calculatedTotals.sumCr,
        closingBalance: calculatedTotals.running,
        lines: calculatedTotals.lines.map((l) => {
          const serial = l.branchSerialNo || l.countrySerialNo || l.superAdminSerialNo || null;
          const rznNo = l.referenceNo || serial;
          const rznName = l.sourceTable === "roznamcha_entries" ? "Roznamcha" : l.sourceTable === "ledger_posting_batches" ? "Batch Posting" : "Journal";
          const userCode = l.createdByName ? l.createdByName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 5) : null;
          const lineBranchCode = (l as any).branchCode || (l.branchName ? l.branchName.slice(0, 4).toUpperCase() : null);

          return {
            date: l.entryDate,
            serial,
            entryNo: serial || l.referenceNo || null,
            rznNo: rznNo || null,
            rznName,
            manualRef: l.referenceNo,
            source: l.sourceTable,
            branch: l.branchName ?? null,
            branchCode: lineBranchCode,
            user: l.createdByName,
            userCode,
            description: l.description,
            currency: l.currency,
            usdRate: l.usdRate,
            usdAmount: l.usdAmount,
            debit: l.debit || 0,
            credit: l.credit || 0,
            balance: l.runningBalance || 0,
          };
        }),
        printedBy,
        printedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
        filterNote: filtered ? `${tr(filterType === "user" ? "User" : filterType === "branch" ? "Branch" : "Country")}: ${filterValue}` : null,
      },
      { lang, orientation }
    );
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
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-700/10 dark:bg-emerald-950/50 dark:text-emerald-300 whitespace-nowrap">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  {isSuperAdmin ? tr("Super Admin Scope") : tr("Authorized Ledger Scope")}
                </span>
                <h1 className="text-base font-black text-slate-900 dark:text-slate-100">
                  {tr("Detailed Ledger Statement")}
                </h1>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                {tr("Standard ERP navigation and live multi-currency ledger drill-down")}
              </p>
            </div>
          </div>

          {/* Quick Print / Export Tools */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="ledger-print-portrait"
              disabled={!header}
              onClick={() => { void printStatement("portrait"); }}
              className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-bold shadow-xs"
              title={centralT(lang, "lprint.portrait", "Print Portrait")}
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{centralT(lang, "lprint.portrait", "Print Portrait")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="ledger-print-landscape"
              disabled={!header}
              onClick={() => { void printStatement("landscape"); }}
              className="h-8 gap-1.5 rounded-lg px-2.5 text-xs font-bold shadow-xs"
              title={centralT(lang, "lprint.landscape", "Print Landscape")}
            >
              <Printer className="h-3.5 w-3.5 rotate-90" />
              <span className="hidden sm:inline">{centralT(lang, "lprint.landscape", "Print Landscape")}</span>
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
              accountCards
              richList
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

          {/* Filter by Country / Branch / User */}
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
              {isSuperAdmin && <option value="country">{tr("Country")}</option>}
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
              className="h-8 gap-1.5 rounded-lg px-3.5 text-xs font-bold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white"
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

      {/* ── Bank-Style Account Details & Statement Totals (Matching Approved Layout) ── */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        {/* Section 1 Header: ACCOUNT DETAILS / CUSTOMER LEDGER */}
        <div className="bg-[#f0f4f9] dark:bg-slate-800 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            {tr("ACCOUNT DETAILS / CUSTOMER LEDGER")}
          </span>
          <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
            {header?.ledgerCurrency || "—"}
          </span>
        </div>

        {/* Section 1 Body: 7 Sequential Rows */}
        <div className="p-4 space-y-3.5 text-xs">
          {/* Row 1: Account Number, Customer Number, Account Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Account Number")}</div>
              <div className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                <bdi dir="ltr">{header?.accountCode || header?.ledgerCode || "—"}</bdi>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Customer Number")}</div>
              <div className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                <bdi dir="ltr">{header?.customerNumber || "—"}</bdi>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Account Type")}</div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                {tv(header?.accountKind) || "—"}
              </div>
            </div>
          </div>

          {/* Row 2: Account Name (prominent!) */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Account Name")}</div>
            <div className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
              {header?.accountName || header?.ledgerName || "—"}
            </div>
          </div>

          {/* Row 3: Category, Currency, Opened Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Category")}</div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                {tv(header?.accountKind) || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Currency")}</div>
              <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                <bdi dir="ltr">{header?.ledgerCurrency || "—"}</bdi>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Opened Date")}</div>
              <div className="font-medium text-slate-800 dark:text-slate-200">
                <bdi dir="ltr">{header?.createdAt ? header.createdAt.slice(0, 10) : "—"}</bdi>
              </div>
            </div>
          </div>

          {/* Row 4: Branch Name, Branch Code, Country Code */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Branch Name")}</div>
              <div className="font-medium text-slate-800 dark:text-slate-200">
                {header?.cityBranchName || header?.countryBranchName || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Branch Code")}</div>
              <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                <bdi dir="ltr">{(header as any)?.branchCode || (header as any)?.cityBranchCode || (header as any)?.countryBranchCode || "—"}</bdi>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Country Code")}</div>
              <div className="font-mono font-bold text-slate-800 dark:text-slate-200">
                <bdi dir="ltr">{(header as any)?.countryCode || header?.countryName?.slice(0, 3)?.toUpperCase() || "—"}</bdi>
              </div>
            </div>
          </div>

          {/* Row 5: Country, State / Province, City */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Country")}</div>
              <div className="font-medium text-slate-800 dark:text-slate-200">
                {header?.countryName || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("State / Province")}</div>
              <div className="font-medium text-slate-800 dark:text-slate-200">
                {(header as any)?.stateName || "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("City")}</div>
              <div className="font-medium text-slate-800 dark:text-slate-200">
                {(header as any)?.cityName || "—"}
              </div>
            </div>
          </div>

          {/* Row 6: Final Address (prominent!) */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Final Address")}</div>
            <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              {(header as any)?.accountAddress || header?.address || "—"}
            </div>
          </div>

          {/* Row 7: Phone, WhatsApp, Email */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Phone")}</div>
              <div className="font-mono text-slate-800 dark:text-slate-200">
                <bdi dir="ltr">{(header as any)?.accountPhone || pickContact(["mobile", "phone"]) || "—"}</bdi>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("WhatsApp")}</div>
              <div className="font-mono text-slate-800 dark:text-slate-200">
                <bdi dir="ltr">{pickContact(["whatsapp"]) || (header as any)?.accountPhone || "—"}</bdi>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Email")}</div>
              <div className="text-slate-800 dark:text-slate-200">
                {(header as any)?.accountEmail || pickContact(["email"]) || "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2 Header: STATEMENT TOTALS & PERIOD */}
        <div className="bg-[#f0f4f9] dark:bg-slate-800 px-4 py-2 border-t border-b border-slate-200 dark:border-slate-700">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            {tr("STATEMENT TOTALS & PERIOD")}
          </span>
        </div>

        {/* Section 2 Body: 2 Sequential Rows */}
        <div className="p-4 space-y-3.5 text-xs bg-slate-50/40 dark:bg-slate-900/40">
          {/* Row 1: Total Debit, Total Credit, Grand Balance */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Total Debit")}</div>
              <div className="font-mono font-black text-rose-700 dark:text-rose-400 text-sm sm:text-base">
                <bdi dir="ltr">{fmt(calculatedTotals.sumDr)} {header?.ledgerCurrency || ""}</bdi>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Total Credit")}</div>
              <div className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm sm:text-base">
                <bdi dir="ltr">{fmt(calculatedTotals.sumCr)} {header?.ledgerCurrency || ""}</bdi>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Grand Balance")}</div>
              <div className="font-mono font-black text-slate-900 dark:text-slate-100 text-sm sm:text-base flex items-center gap-1.5">
                <bdi dir="ltr">{fmt(Math.abs(calculatedTotals.running))} {header?.ledgerCurrency || ""}</bdi>
                <span className={`text-[11px] px-1.5 py-0.2 rounded font-bold ${
                  (calculatedTotals.running >= 0) === (header?.normalBalance === "debit")
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200"
                }`}>
                  {(calculatedTotals.running >= 0) === (header?.normalBalance === "debit") ? "Dr" : "Cr"}
                </span>
              </div>
            </div>
          </div>

          {/* Row 2: Starting Date, Last Date, Total Entries */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Starting Date")}</div>
              <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                <bdi dir="ltr">{fromDate || "—"}</bdi>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Last Date")}</div>
              <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                <bdi dir="ltr">{toDate || "—"}</bdi>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">{tr("Total Entries")}</div>
              <div className="font-mono font-bold text-slate-700 dark:text-slate-300">
                <bdi dir="ltr">{calculatedTotals.lines.length}</bdi>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Ledger Entries Table Card (Matching Approved Design) ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#1c3350] text-white">
                <th className="p-2.5 whitespace-nowrap font-bold text-left">{tr("Date")}</th>
                <th className="p-2.5 whitespace-nowrap font-bold text-left">{tr("Entry No.")}</th>
                <th className="p-2.5 whitespace-nowrap font-bold text-left">{tr("Rzn. No.")}</th>
                <th className="p-2.5 whitespace-nowrap font-bold text-left">{tr("Rzn. Name")}</th>
                <th className="p-2.5 min-w-[240px] font-bold text-left">{tr("Details")}</th>
                <th className="p-2.5 whitespace-nowrap text-right font-bold">{tr("DR")}</th>
                <th className="p-2.5 whitespace-nowrap text-right font-bold">{tr("CR")}</th>
                <th className="p-2.5 whitespace-nowrap text-right font-bold">{tr("Balance")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {calculatedTotals.lines.map((line, idx) => {
                const serial = line.branchSerialNo || line.countrySerialNo || line.superAdminSerialNo || "—";
                const rznNo = line.referenceNo || serial;
                const rznName = line.sourceTable === "roznamcha_entries" ? "Roznamcha" : line.sourceTable === "ledger_posting_batches" ? "Journal" : "General";
                return (
                  <tr
                    key={idx}
                    className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${idx % 2 === 1 ? "bg-slate-50/50 dark:bg-slate-800/20" : "bg-white dark:bg-slate-900"}`}
                  >
                    <td className="p-2.5 font-mono whitespace-nowrap text-slate-600 dark:text-slate-400">
                      <bdi dir="ltr">{line.entryDate?.split("T")[0] || "—"}</bdi>
                    </td>
                    <td className="p-2.5 font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      <bdi dir="ltr">{serial}</bdi>
                    </td>
                    <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      <bdi dir="ltr">{rznNo}</bdi>
                    </td>
                    <td className="p-2.5 whitespace-nowrap">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {rznName}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-700 dark:text-slate-300 max-w-md">
                      <div className="font-medium">{line.description || "—"}</div>
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {line.debit ? <bdi dir="ltr">{fmt(line.debit)}</bdi> : <span className="text-slate-400 font-normal">-</span>}
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {line.credit ? <bdi dir="ltr">{fmt(line.credit)}</bdi> : <span className="text-slate-400 font-normal">-</span>}
                    </td>
                    <td className="p-2.5 text-right font-mono font-black text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      <bdi dir="ltr">{fmt(line.runningBalance)}</bdi>
                    </td>
                  </tr>
                );
              })}

              {calculatedTotals.lines.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold">{tr("No ledger transactions found for the selected period.")}</p>
                    <p className="text-xs mt-1">{tr("Please choose an account from the search selector above or adjust your date range.")}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
