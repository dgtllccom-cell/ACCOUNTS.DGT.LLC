"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { buildLedgerStatementPrintHtml, type LedgerPrintData, type LedgerPrintOrientation } from "@/lib/reports/ledger-statement-print";
import { printStore } from "@/lib/store/print-store";
import { renderPaginatedPdf } from "@/lib/reports/pdf-paginate";
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
  MoreVertical,
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

  const [actionsOpen, setActionsOpen] = useState(false);

  /** Print = the shared A4 preview (orientation / language switch, "Page x of N", Print and Download PDF); PDF = the same document rendered straight to a file. */
  async function deliverStatement(data: LedgerPrintData, orientation: LedgerPrintOrientation, mode: "print" | "pdf") {
    const build = (l: string, o: LedgerPrintOrientation) => buildLedgerStatementPrintHtml(data, { lang: l, orientation: o });
    const title = `${tr("Detailed Ledger Statement")} - ${data.account.name}`;
    if (mode === "print") {
      printStore.openPrint(build(lang, orientation), title, { lang, rebuild: ({ lang: l, orientation: o }) => build(l, o) });
      return;
    }
    const safe = (v: string) => String(v || "").replace(/[^\w.-]+/g, "_");
    await renderPaginatedPdf({
      html: build(lang, orientation),
      orientation,
      filename: `ledger-statement-${safe(data.account.code || data.account.name)}-${data.fromDate}_${data.toDate}.pdf`,
      pageWord: translateHeader(lang, "PAGE"),
      rtl: isRtl,
    });
  }

  async function printStatement(orientation: LedgerPrintOrientation, mode: "print" | "pdf" = "print") {
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

    const data: LedgerPrintData = {
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
    };
    await deliverStatement(data, orientation, mode);
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
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="icon"
                data-testid="ledger-actions-menu"
                disabled={!header}
                aria-label={centralT(lang, "pdfui.ram_report_actions", "Report actions")}
                aria-haspopup="menu"
                aria-expanded={actionsOpen}
                onClick={() => setActionsOpen((v) => !v)}
                className="h-8 w-8 rounded-lg shadow-xs"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
              {actionsOpen ? (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setActionsOpen(false)} />
                  <div role="menu" className="absolute end-0 top-full z-40 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center gap-1.5 px-3 pb-0.5 pt-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400"><Printer className="h-3 w-3" />{centralT(lang, "common.print", "Print")}</div>
                <button type="button" role="menuitem" data-testid="ledger-print-portrait" onClick={() => { setActionsOpen(false); void printStatement("portrait", "print"); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">
                  {centralT(lang, "pdfprev.portrait", "Portrait")} · A4
                </button>
                <button type="button" role="menuitem" data-testid="ledger-print-landscape" onClick={() => { setActionsOpen(false); void printStatement("landscape", "print"); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">
                  {centralT(lang, "pdfprev.landscape", "Landscape")} · A4
                </button>
                    <div className="mt-1 flex items-center gap-1.5 border-t border-slate-100 px-3 pb-0.5 pt-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400 dark:border-slate-800"><Download className="h-3 w-3" />{centralT(lang, "ledger.lgrv_pdf_export", "PDF Export")}</div>
                <button type="button" role="menuitem" data-testid="ledger-pdf-portrait" onClick={() => { setActionsOpen(false); void printStatement("portrait", "pdf"); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">
                  {centralT(lang, "pdfprev.portrait", "Portrait")} · A4
                </button>
                <button type="button" role="menuitem" data-testid="ledger-pdf-landscape" onClick={() => { setActionsOpen(false); void printStatement("landscape", "pdf"); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">
                  {centralT(lang, "pdfprev.landscape", "Landscape")} · A4
                </button>
                    <div className="mt-1 border-t border-slate-100 dark:border-slate-800" />
                <button type="button" role="menuitem" data-testid="ledger-export-csv" onClick={() => { setActionsOpen(false); exportCsv(); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800">
                  {tr("Export CSV")}
                </button>
                  </div>
                </>
              ) : null}
            </div>
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

      {/* ── Top Three Information Panels (Branch Details, Customer / Account Details, Ledger / Balance Summary) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Panel 1: Branch Details */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5 dark:border-slate-800">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>{tr("Branch Details")}</span>
            </h5>
            <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-mono font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
              {(header as any)?.cityBranchCode || (header as any)?.countryBranchCode || (header as any)?.branchCode || "—"}
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Branch Name")}:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-end truncate">
                {header?.cityBranchName || header?.countryBranchName || tr("Main Office")}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Branch Code")}:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                <bdi dir="ltr">{(header as any)?.branchCode || (header as any)?.cityBranchCode || (header as any)?.countryBranchCode || "—"}</bdi>
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Country")}:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{header?.countryName || "—"}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("State / Province")}:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{(header as any)?.stateName || "—"}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("City")}:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{(header as any)?.cityName || "—"}</span>
            </div>
            <div className="flex justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-medium shrink-0">{tr("Address")}:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 text-end text-[11px] truncate">
                {header?.address || [header?.cityName, header?.countryName].filter(Boolean).join(", ") || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Panel 2: Customer / Account Details */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5 dark:border-slate-800">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{tr("Customer / Account Details")}</span>
            </h5>
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-mono font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
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
                <bdi dir="ltr">{header?.accountCode || header?.ledgerCode || "—"}</bdi>
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Account Type")}:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                {tv(header?.accountKind) || "—"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Phone")}:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                <bdi dir="ltr">{pickContact(["mobile", "phone"]) || (header as any)?.accountPhone || "—"}</bdi>
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("WhatsApp")}:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">
                <bdi dir="ltr">{pickContact(["whatsapp"]) || (header as any)?.accountPhone || "—"}</bdi>
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Email")}:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300 text-[11px] truncate">
                {pickContact(["email"]) || (header as any)?.accountEmail || "—"}
              </span>
            </div>
            <div className="flex justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-medium shrink-0">{tr("Final Address")}:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 text-end text-[11px] truncate">
                {(header as any)?.accountAddress || header?.address || "—"}
              </span>
            </div>
          </div>
        </div>

        {/* Panel 3: Ledger / Balance Summary */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5 dark:border-slate-800">
            <h5 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>{tr("Ledger / Balance Summary")}</span>
            </h5>
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-mono font-bold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              {calculatedTotals.lines.length} {tr("Entries")}
            </span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Total Debit")}:</span>
              <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                <bdi dir="ltr">{fmt(calculatedTotals.sumDr)}</bdi>
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Total Credit")}:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                <bdi dir="ltr">{fmt(calculatedTotals.sumCr)}</bdi>
              </span>
            </div>
            <div className="flex justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-400 font-medium">{tr("Grand Balance")}:</span>
              <span
                className={`font-mono font-black text-sm ${
                  calculatedTotals.running < 0
                    ? "text-rose-600 dark:text-rose-400"
                    : calculatedTotals.running > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                <bdi dir="ltr">{fmt(calculatedTotals.running)} {header?.ledgerCurrency || ""}</bdi>
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Starting Date")}:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300"><bdi dir="ltr">{fromDate || "—"}</bdi></span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Last Date")}:</span>
              <span className="font-mono text-slate-700 dark:text-slate-300"><bdi dir="ltr">{toDate || "—"}</bdi></span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400 font-medium">{tr("Total Entries")}:</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                <bdi dir="ltr">{calculatedTotals.lines.length}</bdi>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Ledger Entries Table Card (Original Yellow Header Style) ── */}
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

        <div className="overflow-x-auto rounded-xl border border-amber-300 dark:border-amber-800/80 shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#fef3c7] text-[#78350f] dark:bg-amber-950/80 dark:text-amber-200 border-b-2 border-amber-300 dark:border-amber-700 font-bold">
                <Th className="p-2.5 whitespace-nowrap text-center font-bold text-amber-950 dark:text-amber-100 border-x border-amber-200/60 dark:border-amber-800/60">{tr("Date")}</Th>
                <Th className="p-2.5 whitespace-nowrap text-center font-bold text-amber-950 dark:text-amber-100 border-x border-amber-200/60 dark:border-amber-800/60">{tr("Serial No")}</Th>
                <Th className="p-2.5 whitespace-nowrap font-bold text-amber-950 dark:text-amber-100 border-x border-amber-200/60 dark:border-amber-800/60">{tr("User / Operator")}</Th>
                <Th className="p-2.5 whitespace-nowrap font-bold text-amber-950 dark:text-amber-100 border-x border-amber-200/60 dark:border-amber-800/60">{tr("Branch Name")}</Th>
                <Th className="p-2.5 whitespace-nowrap font-bold text-amber-950 dark:text-amber-100 border-x border-amber-200/60 dark:border-amber-800/60">{tr("Entry Type")}</Th>
                <Th className="p-2.5 whitespace-nowrap font-bold text-amber-950 dark:text-amber-100 border-x border-amber-200/60 dark:border-amber-800/60">{tr("Ref No")}</Th>
                <Th className="p-2.5 min-w-[200px] font-bold text-amber-950 dark:text-amber-100 border-x border-amber-200/60 dark:border-amber-800/60">{tr("Description / Particulars")}</Th>
                <Th className="p-2.5 whitespace-nowrap text-right font-bold text-rose-800 dark:text-rose-300 border-x border-amber-200/60 dark:border-amber-800/60">{tr("Debit (Dr)")}</Th>
                <Th className="p-2.5 whitespace-nowrap text-right font-bold text-emerald-800 dark:text-emerald-300 border-x border-amber-200/60 dark:border-amber-800/60">{tr("Credit (Cr)")}</Th>
                <Th className="p-2.5 whitespace-nowrap text-right font-black text-amber-950 dark:text-amber-100 border-x border-amber-200/60 dark:border-amber-800/60">{tr("Running Balance")}</Th>
                <Th className="p-2.5 whitespace-nowrap text-center font-bold text-amber-950 dark:text-amber-100 border-x border-amber-200/60 dark:border-amber-800/60">{tr("USD Rate")}</Th>
                <Th className="p-2.5 whitespace-nowrap text-right font-bold text-blue-800 dark:text-blue-300 border-x border-amber-200/60 dark:border-amber-800/60">{tr("Dr (USD)")}</Th>
                <Th className="p-2.5 whitespace-nowrap text-right font-bold text-amber-900 dark:text-amber-200 border-x border-amber-200/60 dark:border-amber-800/60">{tr("Cr (USD)")}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {calculatedTotals.lines.map((line, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors ${idx % 2 === 1 ? "bg-slate-50/50 dark:bg-slate-800/20" : "bg-white dark:bg-slate-900"}`}
                >
                  <td className="p-2.5 text-center font-mono whitespace-nowrap text-slate-600 dark:text-slate-400">
                    <bdi dir="ltr">{line.entryDate?.split("T")[0] || "—"}</bdi>
                  </td>
                  <td className="p-2.5 text-center font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    <bdi dir="ltr">{line.branchSerialNo || line.countrySerialNo || line.superAdminSerialNo || "—"}</bdi>
                  </td>
                  <td className="p-2.5 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {line.createdByName || tr("User")}
                  </td>
                  <td className="p-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {line.branchName || tr("Main Office")}
                  </td>
                  <td className="p-2.5 whitespace-nowrap">
                    <span className="inline-block rounded px-2 py-0.5 text-[11px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 whitespace-nowrap">
                      {line.sourceTable === "ledger_posting_batches"
                        ? tr("Opening Balance")
                        : line.sourceTable === "roznamcha_entries"
                        ? tr("Roznamcha")
                        : tv(line.sourceTable) || "—"}
                    </span>
                  </td>
                  <td className="p-2.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    <bdi dir="ltr">{line.referenceNo || "—"}</bdi>
                  </td>
                  <td className="p-2.5 text-slate-700 dark:text-slate-300 max-w-sm">
                    <div>{line.description || "—"}</div>
                    {((line as any).perKgRate || (line as any).purchaseCurrency || (line as any).totalPurchaseAmount) ? (
                      <div className="text-[11px] text-slate-400 mt-1 pt-1 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                        {(line as any).perKgRate && <span>{tr("Per KG Rate")}: {fmt((line as any).perKgRate)}</span>}
                        {(line as any).purchaseCurrency && <span>{tr("Currency")}: {(line as any).purchaseCurrency}</span>}
                        {(line as any).totalPurchaseAmount && <span>{tr("Total")}: {fmt((line as any).totalPurchaseAmount)}</span>}
                      </div>
                    ) : null}
                  </td>
                  <td className="p-2.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    {line.debit ? <bdi dir="ltr">{fmt(line.debit)}</bdi> : "—"}
                  </td>
                  <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    {line.credit ? <bdi dir="ltr">{fmt(line.credit)}</bdi> : "—"}
                  </td>
                  <td
                    className={`p-2.5 text-right font-mono font-black whitespace-nowrap ${
                      line.runningBalance < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : line.runningBalance > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <bdi dir="ltr">{fmt(line.runningBalance)}</bdi>
                  </td>
                  <td className="p-2.5 text-center font-mono text-slate-500 whitespace-nowrap">
                    {line.usdRate ? <bdi dir="ltr">{line.usdRate.toFixed(4)}</bdi> : "—"}
                  </td>
                  <td className="p-2.5 text-right font-mono font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                    {line.debit ? <bdi dir="ltr">{fmt((line as any).drUsd)}</bdi> : "—"}
                  </td>
                  <td className="p-2.5 text-right font-mono font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                    {line.credit ? <bdi dir="ltr">{fmt((line as any).crUsd)}</bdi> : "—"}
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
                <tr className="bg-amber-100/80 dark:bg-amber-950/70 font-bold border-t-2 border-amber-300 dark:border-amber-700">
                  <td colSpan={7} className="p-2.5 text-right uppercase tracking-wider text-amber-950 dark:text-amber-100 font-black">
                    {tr("Grand Totals")}
                  </td>
                  <td className="p-2.5 text-right font-mono font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    <bdi dir="ltr">{fmt(calculatedTotals.sumDr)}</bdi>
                  </td>
                  <td className="p-2.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                    <bdi dir="ltr">{fmt(calculatedTotals.sumCr)}</bdi>
                  </td>
                  <td
                    className={`p-2.5 text-right font-mono font-black whitespace-nowrap ${
                      calculatedTotals.running < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : calculatedTotals.running > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <bdi dir="ltr">{fmt(calculatedTotals.running)}</bdi>
                  </td>
                  <td className="p-2.5 text-center text-slate-400">—</td>
                  <td className="p-2.5 text-right font-mono font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                    <bdi dir="ltr">{fmt(calculatedTotals.sumDrUsd)}</bdi>
                  </td>
                  <td className="p-2.5 text-right font-mono font-bold text-amber-700 dark:text-amber-300 whitespace-nowrap">
                    <bdi dir="ltr">{fmt(calculatedTotals.sumCrUsd)}</bdi>
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