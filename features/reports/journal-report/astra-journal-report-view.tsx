"use client";

import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { useEffect, useMemo, useState, Suspense } from "react";
import {
  BookOpen,
  Building2,
  CalendarDays,
  ChevronLeft,
  ClipboardList,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  MoreVertical,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CashEntryForm } from "@/features/roznamcha/components/cash-entry-form";
import { cn } from "@/lib/utils";
import type { RoznamchaType } from "@/lib/accounting/roznamcha-flow";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { openUniversalPrintReport } from "@/lib/reports/universal-print-engine";

import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { fetchBranding, brandingName } from "@/lib/branding/client";
import { useSearchParams, useRouter } from "next/navigation";
import { Th } from "@/components/ui/translated-th";
import { ErpDatePicker } from "@/components/ui/erp-date-picker";

type JournalScope = "country" | "city" | "construction";

type ApiRow = {
  ledgerId: string;
  ledgerCode: string;
  ledgerName: string;
  accountCode: string | null;
  accountName: string | null;
  accountKind: string | null;
  scope: string;
  ledgerCurrency: string | null;
  countryName: string | null;
  countryBranchName: string | null;
  countryBranchCode?: string | null;
  cityBranchName: string | null;
  cityBranchCode?: string | null;
  branchCode?: string | null;
  companyName: string | null;
  status: "active" | "inactive";
  entries: number;
  debit: number;
  credit: number;
  balance: number;
  firstEntryDate?: string | null;
  lastEntryDate: string | null;
  lastReferenceNo: string | null;
  lastDescription: string | null;
};

type ApiResponse = {
  generatedAt?: string;
  summary?: {
    entries: number;
    debit: number;
    credit: number;
    balance: number;
    activeLedgers?: number;
    totalLedgers?: number;
  };
  rows?: ApiRow[];
};

type JournalRow = {
  id: string;
  voucherNo: string;
  accountNumber: string;
  accountName: string;
  date: string;
  endDate: string;
  country: string;
  city: string;
  branch: string;
  branchCode: string;
  project: string;
  site: string;
  contractor: string;
  voucherType: string;
  txType: string;
  account: string;
  narration: string;
  currency: string;
  debit: number;
  credit: number;
  balance: number;
  trend: string;
  status: string;
  entries?: number;
  companyName?: string;
};

function fmt(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateDisplay(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function normalize(value: unknown) {
  return String(value ?? "").toLowerCase().trim();
}

function csvEscape(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function exportCsv(rows: JournalRow[], scope: JournalScope, headers: string[]) {
  const body = rows.map((row, index) =>
    [
      index + 1,
      row.accountNumber,
      row.accountName,
      row.branch,
      formatDateDisplay(row.date),
      formatDateDisplay(row.endDate),
      row.entries ?? 0,
      fmt(row.debit),
      fmt(row.credit),
      fmt(row.balance)
    ].map((cell) => csvEscape(String(cell))).join(",")
  );
  const blob = new Blob([[headers.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${scope}-journal-report.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function mapApiRows(rows: ApiRow[], scope: JournalScope): JournalRow[] {
  return rows.map((row, index) => {
    const city = row.cityBranchName?.replace(/\s+City\s+Branch$/i, "") || row.countryBranchName?.replace(/\s+Main\s+Branch$/i, "") || "-";
    const debit = Number(row.debit || 0);
    const credit = Number(row.credit || 0);
    const balance = Number(row.balance || 0);
    const accountName = row.accountName || row.ledgerName || "-";
    const txType = debit >= credit ? "Debit" : "Credit";
    const branchCode = row.branchCode || row.cityBranchCode || row.countryBranchCode || "-";
    const firstDate = row.firstEntryDate || row.lastEntryDate || new Date().toISOString().slice(0, 10);
    const lastDate = row.lastEntryDate || row.firstEntryDate || new Date().toISOString().slice(0, 10);

    return {
      id: row.ledgerId,
      voucherNo: row.lastReferenceNo || `JV-${String(index + 1).padStart(4, "0")}`,
      accountNumber: row.accountCode || row.ledgerCode || "-",
      accountName,
      date: firstDate,
      endDate: lastDate,
      country: row.countryName || "-",
      city,
      branch: row.cityBranchName || row.countryBranchName || "-",
      branchCode,
      project: scope === "construction" ? row.companyName || "—" : "-",
      site: scope === "construction" ? row.cityBranchName || row.countryBranchName || "—" : "-",
      contractor: scope === "construction" ? row.accountName || row.ledgerName || "-" : "-",
      voucherType: scope === "construction" ? "Cost Center Journal" : row.scope || "Journal Voucher",
      txType,
      account: accountName,
      narration: row.lastDescription || row.ledgerName || "-",
      currency: row.ledgerCurrency || "-",
      debit,
      credit,
      balance,
      trend: balance >= 0 ? "Increase" : "Decrease",
      status: row.status === "active" ? "Active" : "Inactive",
      entries: row.entries || 0,
      companyName: row.companyName || "-"
    };
  });
}

function titleFor(scope: JournalScope, tt?: (key: string, fallback: string) => string) {
  const tr = tt ?? ((_k: string, f: string) => f);
  if (scope === "country") return tr("ajr.country_admin_report", "Country Admin Report");
  if (scope === "city") return tr("ajr.city_journal_report", "City Journal Report");
  return tr("ajr.construction_journal_report", "Construction Journal Report");
}

function paymentConfigFor(scope: JournalScope): { postingType: RoznamchaType; scopeMode: "super_admin" | "country" | "branch" } {
  if (scope === "country") return { postingType: "country", scopeMode: "country" };
  if (scope === "city") return { postingType: "branch", scopeMode: "branch" };
  return { postingType: "super_admin", scopeMode: "super_admin" };
}

function AstraJournalReportViewContent({ lang: langProp, scope }: { lang: SupportedLanguage; scope: JournalScope }) {
  const activeLang = useActiveLanguage();
  const lang = activeLang !== "en" ? activeLang : langProp;
  const _ = (key: string, fallback: string) => t(lang as never, key as never, fallback);
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlCountry = searchParams?.get("country") || "";

  const todayStr = new Date().toISOString().slice(0, 10);
  const [brandCompany, setBrandCompany] = useState<string | null>(null);
  useEffect(() => {
    fetchBranding(null).then((b) => setBrandCompany(brandingName(b, lang) || null)).catch(() => {});
  }, [lang]);
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [entryOpen, setEntryOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [country, setCountry] = useState(urlCountry);

  useEffect(() => {
    setCountry(urlCountry);
  }, [urlCountry]);
  const [city, setCity] = useState("");
  const [branch, setBranch] = useState("");
  const [project, setProject] = useState("");
  const [site, setSite] = useState("");
  const [contractor, setContractor] = useState("");
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [sortKey, setSortKey] = useState<keyof JournalRow>("accountName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  async function loadReport(fDate = fromDate, tDate = toDate, query = search) {
    setLoading(true);
    setMessage("");
    try {
      const reportScope = scope === "city" ? "branch" : scope === "country" ? "country" : "super_admin";
      const qp = new URLSearchParams({ 
        reportScope, 
        limit: "250",
        fromDate: fDate,
        toDate: tDate
      });
      if (query.trim()) {
        qp.set("q", query.trim());
      }
      const response = await fetch(`/api/erp/accounting/reports/ledger/general?${qp.toString()}`, { cache: "no-store" });
      const body = (await response.json().catch(() => ({}))) as ApiResponse;
      if (!response.ok) throw new Error("Journal report API could not be loaded.");
      const mapped = mapApiRows(body.rows ?? [], scope);
      setRows(mapped);
      setGeneratedAt(body.generatedAt || new Date().toISOString());
      if (!mapped.length) setMessage("No journal vouchers found for the selected filters.");
    } catch (error) {
      setRows([]);
      setGeneratedAt(new Date().toISOString());
      setMessage(error instanceof Error ? error.message : "Journal report could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport(fromDate, toDate, search);

    const handleSaved = () => {
      void loadReport(fromDate, toDate, search);
    };

    window.addEventListener("erp:posting-saved", handleSaved);
    window.addEventListener("erp:posting-deleted", handleSaved);
    return () => {
      window.removeEventListener("erp:posting-saved", handleSaved);
      window.removeEventListener("erp:posting-deleted", handleSaved);
    };
  }, [scope, fromDate, toDate]);

  const options = useMemo(() => ({
    countries: Array.from(new Set(rows.map((row) => row.country).filter(Boolean))),
    cities: Array.from(new Set(rows.map((row) => row.city).filter(Boolean))),
    branches: Array.from(new Set(rows.map((row) => row.branch).filter(Boolean))),
    projects: Array.from(new Set(rows.map((row) => row.project).filter((value) => value && value !== "-"))),
    sites: Array.from(new Set(rows.map((row) => row.site).filter((value) => value && value !== "-"))),
    contractors: Array.from(new Set(rows.map((row) => row.contractor).filter((value) => value && value !== "-")))
  }), [rows]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    const list = rows.filter((row) => {
      if (draftStatus && normalize(row.status) !== normalize(draftStatus)) return false;
      if (country) {
        const normRowCountry = normalize(row.country);
        const normFilterCountry = normalize(country);
        let match = normRowCountry === normFilterCountry || 
                    normRowCountry.includes(normFilterCountry) || 
                    normFilterCountry.includes(normRowCountry);
        
        // Special case for UAE / United Arab Emirates / Dubai
        if (!match && (normFilterCountry === "uae" || normFilterCountry === "dubai" || normFilterCountry === "united arab emirates")) {
          match = normRowCountry.includes("emirates") || normRowCountry.includes("uae") || normRowCountry.includes("dubai");
        }
        
        if (!match) return false;
      }
      if (city && row.city !== city) return false;
      if (branch && row.branch !== branch) return false;
      if (project && row.project !== project) return false;
      if (site && row.site !== site) return false;
      if (contractor && row.contractor !== contractor) return false;
      if (!q) return true;
      return Object.values(row).some((value) => normalize(value).includes(q));
    });
    return [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const result = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? result : -result;
    });
  }, [branch, city, contractor, country, draftStatus, project, rows, search, site, sortDir, sortKey]);

  // Earliest date & latest date across filtered rows
  const { minDate, maxDate } = useMemo(() => {
    let min = fromDate;
    let max = toDate;
    for (const r of filtered) {
      if (r.date && (!min || r.date < min)) min = r.date;
      if (r.endDate && (!max || r.endDate > max)) max = r.endDate;
    }
    return { minDate: min, maxDate: max };
  }, [filtered, fromDate, toDate]);

  const summary = useMemo(() => ({
    vouchers: filtered.length,
    debit: filtered.reduce((sum, row) => sum + row.debit, 0),
    credit: filtered.reduce((sum, row) => sum + row.credit, 0),
    balance: filtered.reduce((sum, row) => sum + row.balance, 0),
    active: filtered.filter((row) => row.status === "Active").length,
    accounts: new Set(filtered.map((row) => row.accountNumber).filter(Boolean)).size,
    creditAccounts: filtered.filter((row) => row.credit > 0).length,
    debitAccounts: filtered.filter((row) => row.debit > 0).length
  }), [filtered]);

  const paymentConfig = paymentConfigFor(scope);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  function reset() {
    setSearch("");
    setDraftStatus("");
    setCountry("");
    setCity("");
    setBranch("");
    setProject("");
    setSite("");
    setContractor("");
    setFromDate(todayStr);
    setToDate(todayStr);
    setPage(1);
    void loadReport(todayStr, todayStr, "");
  }

  function openPrint(autoPrint: boolean) {
    const tt = _;
    openUniversalPrintReport({
      title: titleFor(scope, _),
      subtitle: tt("jrn.roznamcha_journal", "Journal Report"),
      lang,
      moduleType: "journal",
      orientation: "landscape",
      autoPrint,
      scope: {
        scopeLevel: titleFor(scope, _),
        dateRange: `${formatDateDisplay(minDate)} → ${formatDateDisplay(maxDate)}`,
        userName: "ERP User",
      },
      kpis: [
        { label: tt("bankroz.total_debit", "Total Debit"), value: summary.debit, color: "amber" },
        { label: tt("bankroz.total_credit", "Total Credit"), value: summary.credit, color: "emerald" },
        { label: tt("jrn.net_balance", "Final Balance"), value: summary.balance, color: "blue" },
        { label: tt("jrn.entry_count", "Total Transactions"), value: filtered.length, color: "purple" },
      ],
      filters: [
        { label: tt("jrn.date_range", "Date Range"), value: `${formatDateDisplay(minDate)} → ${formatDateDisplay(maxDate)}` },
        { label: tt("acct.report_type", "Report Type"), value: titleFor(scope, _) },
      ],
      columns: [
        { key: "sno", label: tt("rozrep.sno", "S.No"), width: "4%" },
        { key: "date", label: tt("rozrep.date", "Date"), format: "date", width: "9%" },
        { key: "voucher", label: tt("bankroz.entry_no", "Voucher No"), width: "10%" },
        { key: "branch", label: tt("rozrep.branch", "Branch"), width: "10%" },
        { key: "account", label: tt("rozrep.account_name", "Account"), width: "16%" },
        { key: "narration", label: tt("rozrep.narration", "Narration / Remarks"), width: "21%" },
        { key: "debit", label: tt("rozrep.debit", "Debit"), align: "right", format: "currency", width: "10%" },
        { key: "credit", label: tt("rozrep.credit", "Credit"), align: "right", format: "currency", width: "10%" },
        { key: "balance", label: tt("rozrep.balance", "Balance"), align: "right", format: "currency", width: "10%" },
      ],
      rows: filtered.map((r: any, idx: number) => ({
        sno: idx + 1,
        date: r.date,
        voucher: r.voucherNo || "-",
        branch: r.branch || r.branchCode || "-",
        account: r.accountName || r.accountNumber || "-",
        narration: r.narration || "-",
        debit: r.debit || 0,
        credit: r.credit || 0,
        balance: r.balance || 0,
      })),
      totals: {
        debit: summary.debit,
        credit: summary.credit,
        balance: summary.balance,
      },
      showSignatures: true,
      signatureBlocks: [
        { title: tt("bankroz.prepared_by", "Prepared By"), subtitle: "Accounts Officer" },
        { title: tt("bankroz.verified_by", "Verified & Audited"), subtitle: "Accounts Department" },
        { title: tt("bankroz.authorized_signatory", "Authorized Signature"), subtitle: "Chief Executive" },
      ],
    });
  }

  return (
    <div className="w-full space-y-3 font-sans text-foreground animate-in fade-in duration-200" dir={isRtl ? "rtl" : "ltr"}>

      {/* Top Standard ERP Report Toolbar Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white/95 px-3 py-1.5 shadow-xs transition-all dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-wrap items-center gap-2">
          {/* Back Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="h-7 gap-1 rounded-lg border-slate-200 bg-slate-50 px-2.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ChevronLeft className="h-3 w-3" />
            {_("common.back", "Back")}
          </Button>

          {/* Filter Drawer Toggle */}
          <Button
            type="button"
            variant={filtersOpen ? "default" : "outline"}
            size="sm"
            className="h-7 gap-1 rounded-lg px-2 text-[10px] font-bold"
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <SlidersHorizontal className="h-3 w-3" aria-hidden />
            {filtersOpen ? _("ajr.hide_filters", "Hide Filters") : _("ajr.show_filters", "Search / Filters")}
          </Button>

          {/* Live Search Input */}
          <div className="relative min-w-[140px] sm:min-w-[180px]">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={_("ajr.filter_ph", "Filter report...")}
              className="h-7 pl-7 pr-2 text-[11px] rounded-lg"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Reload Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 rounded-lg px-2 text-[10px] font-bold"
            onClick={() => void loadReport(fromDate, toDate, search)}
            disabled={loading}
            title={_("ajr.reload_data", "Reload data")}
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            <span className="hidden md:inline">{_("common.refresh", "Reload")}</span>
          </Button>
        </div>

        {/* Actions Dropdown */}
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 gap-1 rounded-lg px-2.5 text-[10px] font-bold bg-blue-50/50 hover:bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800"
              onClick={() => setActionsMenuOpen((v) => !v)}
            >
              <MoreVertical className="h-3 w-3" />
              {_("ajr.actions", "Actions")}
            </Button>
            {actionsMenuOpen ? (
              <div
                className="absolute right-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95"
                onMouseLeave={() => setActionsMenuOpen(false)}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    void loadReport(fromDate, toDate, search);
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5 text-blue-600" />
                  {_("ajr.reload_report", "Reload Report")}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    openPrint(true);
                  }}
                >
                  <Printer className="h-3.5 w-3.5 text-blue-600" />
                  {_("ajr.print_pdf", "Print / PDF")}
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 text-left"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    exportCsv(filtered, scope, [
                      _("ajr.sr_no", "Serial No"),
                      _("ajr.account_number_col", "Account Number"),
                      _("ajr.account_name_col", "Account Name"),
                      _("ajr.branch_name", "Branch Name"),
                      _("ajr.start_date", "Start Date"),
                      _("ajr.last_entry_date", "Last Entry Date"),
                      _("ajr.entries_today", "Entries Today"),
                      _("ajr.total_debit", "Total Debit"),
                      _("ajr.total_credit", "Total Credit"),
                      _("ajr.balance_col", "Balance"),
                    ]);
                  }}
                >
                  <DownloadActionIcon className="h-3.5 w-3.5 text-teal-600" />
                  {_("ajr.csv_export", "Excel / CSV Export")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Report Header Title Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center justify-center text-blue-900 dark:text-blue-500">
            <div className="text-2xl font-black tracking-tighter flex items-center">
              {brandCompany || t(lang, "acct.brand_short", "Digital Dock ERP")}
              <div className="w-2 h-2 rounded-full bg-emerald-500 ml-1 mb-2.5"></div>
            </div>
            <div className="text-[8px] font-bold tracking-widest text-slate-500 uppercase -mt-1">
              {_("ajr.erp_system", "ERP System")}
            </div>
          </div>
        </div>

        <div className="flex-1 text-center">
          <h1 className="text-lg font-black tracking-tight text-[#0f2942] dark:text-slate-100 uppercase sm:text-xl">
            {scope === "country" ? _("ajr.country_admin_report", "Country Admin Report") : _("ajr.general_ledger_report", "General Ledger Report")}
          </h1>
          <div className="flex items-center justify-center gap-2 mt-0.5">
            <div className="h-px w-10 bg-slate-300 dark:bg-slate-700"></div>
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {scope === "country" ? _("ajr.country_summary_sub", "Complete Financial Summary by Branches") : _("ajr.city_summary_sub", "Country & City Branch Consolidated")}
            </p>
            <div className="h-px w-10 bg-slate-300 dark:bg-slate-700"></div>
          </div>
        </div>

        <div className="text-right">
          <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase">{_("ajr.report_date_time", "Report Date & Time")}</p>
          <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase">
            {generatedAt ? new Date(generatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
          </p>
        </div>
      </div>

      {/* Filter Drawer */}
      {filtersOpen ? (
        <div className="grid gap-2.5 rounded-xl border border-border bg-white dark:bg-slate-900 p-4 shadow-sm md:grid-cols-3 xl:grid-cols-6 animate-in fade-in">
          <Select label={_("common.country", "Country")} value={country} options={options.countries} onChange={setCountry} />
          {scope !== "country" ? <Select label={_("common.city", "City")} value={city} options={options.cities} onChange={setCity} /> : null}
          <Select label={_("common.branch", "Branch")} value={branch} options={options.branches} onChange={setBranch} />
          {scope === "construction" ? <Select label={_("ajr.project", "Project")} value={project} options={options.projects} onChange={setProject} /> : null}
          {scope === "construction" ? <Select label={_("ajr.site", "Site")} value={site} options={options.sites} onChange={setSite} /> : null}
          {scope === "construction" ? <Select label={_("ajr.contractor", "Contractor")} value={contractor} options={options.contractors} onChange={setContractor} /> : null}
          <label className="block">
            <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
              {_("datepick.date_range", "Date Range")}
            </span>
            <ErpDatePicker
              mode="range"
              lang={lang}
              size="sm"
              value={{ from: fromDate || null, to: toDate || null }}
              onApply={(v) => {
                setFromDate(v.from ?? "");
                setToDate(v.to ?? "");
              }}
            />
          </label>
        </div>
      ) : null}

      {/* 4 Executive Summary Details Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <DetailBox
          title={_("ajr.country_details", "Country Details")}
          icon={<div className="h-4 w-4 rounded-full border-2 border-blue-600/50 flex items-center justify-center"><div className="h-1.5 w-1.5 rounded-full bg-blue-600"></div></div>}
          items={[
            { label: _("ajr.country_name", "Country Name"), value: country || "Pakistan", hasFlag: true },
            { label: _("ajr.country_code", "Country Code"), value: "PK" },
            { label: _("ajr.currency", "Currency"), value: "PKR - Pakistan Rupee" }
          ]}
        />
        {scope === "country" ? (
          <DetailBox
            title={_("ajr.admin_details", "Admin Details")}
            icon={<span className="text-blue-600 text-sm">👤</span>}
            items={[
              { label: _("ajr.admin_name", "Admin Name"), value: "Admin Chaman" },
              { label: _("ajr.user_role", "User Role"), value: "Country Admin" },
              { label: _("ajr.user_id", "User ID"), value: "CHAMAN@DGT.LLC" }
            ]}
          />
        ) : (
          <DetailBox
            title={_("ajr.branch_details", "Branch Details")}
            icon={<Building2 className="h-4 w-4 text-blue-600" />}
            items={[
              { label: _("ajr.branch_city", "Branch (City)"), value: "CHAMAN BRANCH" },
              { label: _("ajr.branch_code", "Branch Code"), value: "CHM-001" },
              { label: _("ajr.branch_type", "Branch Type"), value: "CITY BRANCH" }
            ]}
          />
        )}
        {scope === "country" ? (
          <DetailBox
            title={_("ajr.report_details", "Report Details")}
            icon={<CalendarDays className="h-4 w-4 text-blue-600" />}
            items={[
              { label: _("ajr.from_date", "From Date"), value: formatDateDisplay(minDate) },
              { label: _("ajr.to_date", "To Date"), value: formatDateDisplay(maxDate) },
              { label: _("ajr.report_type", "Report Type"), value: _("ajr.country_admin_report", "Country Admin Report") }
            ]}
          />
        ) : (
          <DetailBox
            title={_("ajr.user_details", "User Details")}
            icon={<span className="text-blue-600 text-sm">👤</span>}
            items={[
              { label: _("ajr.user_name", "User Name"), value: "ADMIN CHAMAN" },
              { label: _("ajr.user_role", "User Role"), value: "City Branch Admin" },
              { label: _("ajr.user_id", "User ID"), value: "CHAMAN@DGT.LLC" }
            ]}
          />
        )}
        {scope === "country" ? (
          <DetailBox
            title={_("ajr.summary_overview", "Summary Overview")}
            icon={<ClipboardList className="h-4 w-4 text-blue-600" />}
            items={[
              { label: _("ajr.total_branches", "Total Branches"), value: String(Array.from(new Set(filtered.map(r => r.branchCode || r.branch))).length || 2) },
              { label: _("ajr.total_transactions", "Total Transactions"), value: String(filtered.length) },
              { label: _("ajr.exchange_rate", "Exchange Rate"), value: "1 Base Currency = 1 Base Currency" }
            ]}
          />
        ) : (
          <DetailBox
            title={_("ajr.report_details", "Report Details")}
            icon={<CalendarDays className="h-4 w-4 text-blue-600" />}
            items={[
              { label: _("ajr.from_date", "From Date"), value: formatDateDisplay(minDate) },
              { label: _("ajr.to_date", "To Date"), value: formatDateDisplay(maxDate) },
              { label: _("ajr.report_type", "Report Type"), value: _("ajr.general_ledger_report", "General Ledger Report") }
            ]}
          />
        )}
      </div>

      {/* 5 Executive KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 pt-1">
        <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-xl p-3 flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 bg-rose-100 dark:bg-rose-900/50 rounded-lg flex items-center justify-center">
            <ClipboardList className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-0.5">{_("ajr.total_debit", "Total Debit (Base Curr)")}</p>
            <p className="text-base font-black text-rose-600 dark:text-rose-400 tracking-tight">{fmt(summary.debit)}</p>
          </div>
        </div>
        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl p-3 flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg flex items-center justify-center">
            <ClipboardList className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-0.5">{_("ajr.total_credit", "Total Credit (Base Curr)")}</p>
            <p className="text-base font-black text-emerald-600 dark:text-emerald-400 tracking-tight">{fmt(summary.credit)}</p>
          </div>
        </div>
        <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-xl p-3 flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
            <span className="text-blue-600 dark:text-blue-400 font-bold text-base">⚖</span>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-0.5">{_("ajr.total_balance", "Total Balance (Base Curr)")}</p>
            <p className="text-base font-black text-blue-600 dark:text-blue-400 tracking-tight">{fmt(summary.balance)}</p>
          </div>
        </div>
        <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 rounded-xl p-3 flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 bg-amber-100 dark:bg-amber-900/50 rounded-lg flex items-center justify-center">
            <span className="text-amber-600 dark:text-amber-400 font-bold text-base">≡</span>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-0.5">{_("ajr.total_transactions", "Total Transactions")}</p>
            <p className="text-base font-black text-amber-600 dark:text-amber-400 tracking-tight">{filtered.length}</p>
          </div>
        </div>
        <div className="bg-purple-50/60 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50 rounded-xl p-3 flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="h-9 w-9 shrink-0 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
            <span className="text-purple-600 dark:text-purple-400 font-bold text-base">🪙</span>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-0.5">{_("ajr.exchange_rate", "Exchange Rate")}</p>
            <p className="text-xs font-black text-purple-700 dark:text-purple-400 tracking-tight">1 Base = 1 Base Currency</p>
          </div>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs mt-3 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#0f2942] dark:text-slate-300" />
            <h2 className="text-xs font-black tracking-wider text-[#0f2942] dark:text-slate-200 uppercase">
              {scope === "country" ? _("ajr.branch_wise_summary", "Branch Wise Summary") : _("ajr.ledger_transactions", "Ledger Transactions")}
            </h2>
          </div>
          {scope === "country" && (
            <p className="text-[10px] font-bold text-slate-500">{_("ajr.all_amounts_base", "All amounts are in Base Currency")}</p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] text-xs text-left whitespace-nowrap">
            <thead className="bg-[#0f2942] text-white">
              {scope === "country" ? (
                <tr>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center w-12 border-r border-white/10">{_("ajr.sr_no", "Sr. No.")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">{_("ajr.branch_name", "Branch Name")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">{_("ajr.branch_code", "Branch Code")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">{_("ajr.branch_type", "Branch Type")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">{_("ajr.start_date", "Start Date (First Entry)")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">{_("ajr.last_entry_date", "Last Entry Date")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">{_("ajr.total_transactions", "Total Transactions")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">{_("ajr.total_debit", "Total Debit (Base Curr)")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">{_("ajr.total_credit", "Total Credit (Base Curr)")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">{_("ajr.balance_col", "Balance (Base Curr)")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center">{_("common.status", "Status")}</Th>
                </tr>
              ) : (
                <tr>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center w-12 border-r border-white/10">{_("ajr.sr_no", "Sr. No.")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">{_("ajr.date", "Date")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">{_("ajr.voucher_no", "Voucher No.")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">{_("ajr.voucher_type", "Voucher Type")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider border-r border-white/10">{_("ajr.account_party", "Account / Party")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider border-r border-white/10">{_("ajr.details_narration", "Details / Narration")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">{_("ajr.curr_col", "Curr.")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">{_("ajr.debit_col", "Debit (Base Curr)")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">{_("ajr.credit_col", "Credit (Base Curr)")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">{_("ajr.balance_col", "Balance (Base Curr)")}</Th>
                  <Th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center">{_("ajr.dr_cr", "DR / CR")}</Th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={scope === "country" ? 11 : 11} className="px-3 py-8 text-center font-bold text-slate-400">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                    {_("ajr.loading_report", "Loading report...")}
                  </td>
                </tr>
              ) : scope === "country" ? (
                Array.from(
                  filtered.reduce((map, row) => {
                    const key = row.branchCode && row.branchCode !== "-" ? row.branchCode : row.branch || "unknown";
                    const entryDate = row.date || row.endDate || null;
                    if (!map.has(key)) {
                      map.set(key, {
                        branchName: row.branch,
                        branchCode: row.branchCode && row.branchCode !== "-" ? row.branchCode : key,
                        branchType: _("ajr.city_branch_type", "City Branch"),
                        startDate: entryDate,
                        lastEntryDate: row.endDate || entryDate,
                        transactions: row.entries || 1,
                        debit: row.debit || 0,
                        credit: row.credit || 0,
                        balance: (row.debit || 0) - (row.credit || 0),
                        status: row.status || "Active"
                      });
                    } else {
                      const b = map.get(key);
                      b.transactions += row.entries || 1;
                      b.debit += row.debit || 0;
                      b.credit += row.credit || 0;
                      b.balance = b.debit - b.credit;
                      if (entryDate && (!b.startDate || entryDate < b.startDate)) {
                        b.startDate = entryDate;
                      }
                      if (entryDate && (!b.lastEntryDate || entryDate > b.lastEntryDate)) {
                        b.lastEntryDate = entryDate;
                      }
                    }
                    return map;
                  }, new Map<string, any>()).values()
                ).map((branch: any, index: number) => (
                  <tr key={branch.branchCode || index} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 bg-white dark:bg-slate-900">
                    <td className="px-3 py-3.5 text-center font-bold text-[#0f2942] dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">
                      {index + 1}
                    </td>
                    <td className="px-3 py-3.5 text-center font-semibold text-[#0f2942] dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">
                      {branch.branchName}
                    </td>
                    <td className="px-3 py-3.5 text-center text-[#0f2942] dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 font-mono">
                      {branch.branchCode}
                    </td>
                    <td className="px-3 py-3.5 text-center text-[#0f2942] dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">
                      {branch.branchType}
                    </td>
                    <td className="px-3 py-3.5 text-center font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">
                      {formatDateDisplay(branch.startDate)}
                    </td>
                    <td className="px-3 py-3.5 text-center font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">
                      {formatDateDisplay(branch.lastEntryDate)}
                    </td>
                    <td className="px-3 py-3.5 text-center font-bold text-[#0f2942] dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">
                      {branch.transactions}
                    </td>
                    <td className="px-3 py-3.5 text-center font-black text-rose-600 dark:text-rose-400 border-r border-slate-100 dark:border-slate-800">
                      {branch.debit > 0 ? fmt(branch.debit) : "0.00"}
                    </td>
                    <td className="px-3 py-3.5 text-center font-black text-emerald-600 dark:text-emerald-400 border-r border-slate-100 dark:border-slate-800">
                      {branch.credit > 0 ? fmt(branch.credit) : "0.00"}
                    </td>
                    <td className="px-3 py-3.5 text-center font-black text-[#0f2942] dark:text-blue-400 border-r border-slate-100 dark:border-slate-800">
                      {fmt(branch.balance)}
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", normalize(branch.status) === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200")}>
                        {branch.status || _("common.active", "Active")}
                      </span>
                    </td>
                  </tr>
                ))
              ) : pageRows.length ? (
                pageRows.map((row, index) => {
                  const isDr = row.debit > 0;
                  const isCr = row.credit > 0;
                  const drCrText = isDr ? "DR" : isCr ? "CR" : "-";
                  const drCrColor = isDr ? "text-emerald-600 dark:text-emerald-400" : isCr ? "text-rose-600 dark:text-rose-400" : "text-slate-500";
                  
                  return (
                    <tr key={row.id || index} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 bg-white dark:bg-slate-900">
                      <td className="px-3 py-3 text-center font-bold text-slate-500 border-r border-slate-100 dark:border-slate-800">
                        {(page - 1) * pageSize + index + 1}
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">
                        {formatDateDisplay(row.date)}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 font-mono">
                        {row.voucherNo}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">
                        {(scope as string) === "country" ? _("common.country", "Country") : (scope as string) === "city" ? _("common.branch", "Branch") : _("ajr.project", "Project")}
                      </td>
                      <td className="px-3 py-3 font-bold text-blue-700 dark:text-blue-400 border-r border-slate-100 dark:border-slate-800">
                        {row.accountNumber ? `${row.accountNumber} - ` : ""}{row.accountName}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">
                        <span className="truncate max-w-[250px] inline-block align-bottom" title={row.narration}>{row.narration}</span>
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">
                        {_("ajr.base_curr", "BASE CURR")}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-rose-600 dark:text-rose-400 border-r border-slate-100 dark:border-slate-800">
                        {row.debit > 0 ? fmt(row.debit) : "0.00"}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-emerald-600 dark:text-emerald-400 border-r border-slate-100 dark:border-slate-800">
                        {row.credit > 0 ? fmt(row.credit) : "0.00"}
                      </td>
                      <td className="px-3 py-3 text-right font-black text-[#0f2942] dark:text-blue-400 border-r border-slate-100 dark:border-slate-800">
                        {fmt(row.balance)}
                      </td>
                      <td className={cn("px-3 py-3 text-center font-black", drCrColor)}>
                        {drCrText}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center font-medium text-slate-400">
                    {_("ajr.no_transactions", "No transactions found.")}
                  </td>
                </tr>
              )}
            </tbody>
            {scope === "country" && filtered.length > 0 && !loading && (
              <tfoot className="bg-[#f8fafc] text-[#0f2942] font-black border-t-2 border-slate-300 dark:border-slate-700">
                <tr>
                  <td colSpan={6} className="px-3 py-3.5 uppercase border-r border-slate-200 tracking-wider">{_("ajr.total_label", "Total")}</td>
                  <td className="px-3 py-3.5 text-center border-r border-slate-200">
                    {Array.from(filtered.reduce((map, row) => {
                      const key = row.branchCode && row.branchCode !== "-" ? row.branchCode : row.branch || "unknown";
                      if (!map.has(key)) map.set(key, row.entries || 1);
                      else map.set(key, map.get(key) + (row.entries || 1));
                      return map;
                    }, new Map<string, any>()).values()).reduce((a: any, b: any) => a + b, 0)}
                  </td>
                  <td className="px-3 py-3.5 text-center text-rose-600 border-r border-slate-200">{fmt(summary.debit)}</td>
                  <td className="px-3 py-3.5 text-center text-emerald-600 border-r border-slate-200">{fmt(summary.credit)}</td>
                  <td className="px-3 py-3.5 text-center border-r border-slate-200">{fmt(summary.balance)}</td>
                  <td className="px-3 py-3.5"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        
        {/* Pagination & Footer note */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-md">
            <div className="h-4 w-4 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-[9px]">i</div>
            {_("ajr.base_curr_note", "All amounts are in Base Currency. This report is system generated and does not require any signature.")}
          </div>
          {scope !== "country" && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="h-8 text-xs font-bold px-3">{_("ajr.prev", "Prev")}</Button>
              <span className="text-xs font-black text-slate-700 dark:text-slate-300">{_("ajr.page", "Page")} {page} {_("ajr.of", "of")} {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="h-8 text-xs font-bold px-3">{_("ajr.next", "Next")}</Button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function DetailBox({ title, icon, items }: { title: string, icon: React.ReactNode, items: { label: string, value: string, hasFlag?: boolean }[] }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
      <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/30">
        {icon}
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">{title}</h3>
      </div>
      <div className="px-3.5 py-2.5 space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex flex-wrap items-center">
            <span className="w-28 text-[11px] font-bold text-slate-500 dark:text-slate-400">{item.label}</span>
            <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 ml-1 flex items-center gap-1.5">
              : 
              {item.hasFlag && <span className="inline-block w-4 h-3 bg-green-700 border border-white rounded-[2px] ml-1 shadow-xs flex items-center justify-center text-[6px] text-white overflow-hidden">
                <span className="bg-white w-[5px] h-full ml-auto rounded-l-full"></span>
              </span>}
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const lang = useActiveLanguage() || "en";
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-bold text-foreground outline-none transition focus:border-primary">
        <option value="">{t(lang, "common.all", "All")}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

export function AstraJournalReportView(props: { lang: SupportedLanguage; scope: JournalScope }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm font-semibold text-slate-500">{t(props.lang, "ajr.loading", "Loading Journal Report...")}</div>}>
      <AstraJournalReportViewContent {...props} />
    </Suspense>
  );
}
