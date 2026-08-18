"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Printer,
  Search,
  MoreVertical,
  RefreshCcw,
  SlidersHorizontal,
  Globe2,
  Users,
  DollarSign,
  Receipt,
  ChevronDown,
  ChevronLeft,
  X
} from "lucide-react";
import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { ReportTd, ReportTh } from "@/components/reports/report-primitives";
import { ReportPagination } from "@/features/reports/components/report-pagination";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { apiGet } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";

export type RoznamchaEntryCategory = "business" | "bank" | "cash" | "invoice" | "transfer";

function getCategoryLabel(cat: RoznamchaEntryCategory | null, lang: SupportedLanguage) {
  if (!cat) return "-";
  switch (cat) {
    case "business": return t(lang, "nav.business_report", "Business");
    case "bank": return t(lang, "nav.bank_report_roz", "Bank");
    case "cash": return t(lang, "nav.cash_entry_report", "Cash Entry");
    case "invoice": return t(lang, "nav.invoice_report", "Invoice");
    case "transfer": return t(lang, "roz.transfer_report", "Transfer");
    default: return cat;
  }
}

type ReportLine = {
  id: string;
  payment_entry_type: string | null;
  debit: number | null;
  credit: number | null;
  currency: string | null;
  account_number?: string | null;
  ledger_id: string | null;
  ledgers?: { name: string; code: string } | null;
};

type ReportRow = {
  id: string;
  type: string;
  entry_category: RoznamchaEntryCategory | null;
  super_admin_serial_number?: string | null;
  entry_serial_number?: string | null;
  country_transaction_serial_number?: string | null;
  branch_transaction_serial_number?: string | null;
  country_id: string | null;
  countries?: { name: string; currency_code?: string } | null;
  country_branch_id: string | null;
  country_branches?: { name: string; code?: string } | null;
  city_branch_id: string | null;
  city_branches?: { name: string; code?: string } | null;
  journal_no: string;
  voucher_no: string;
  entry_date: string;
  posted_at: string | null;
  reference_no: string | null;
  source_reference_no: string | null;
  source_module: string | null;
  source_transaction_type: string | null;
  narration: string | null;
  status: string;
  created_by: string | null;
  profiles?: { full_name: string } | null;
  created_at: string;
  roznamcha_lines: ReportLine[];
};

type ReportResponse = {
  entries: ReportRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalDebit: number;
  totalCredit: number;
  netBalance: number;
  postedCount: number;
  pendingCount: number;
};

type SessionInfo = {
  user?: {
    id: string;
    email: string;
    fullName?: string;
  };
  roles?: string[];
  scopes: {
    countryIds: string[];
    countryBranchIds: string[];
    cityBranchIds: string[];
    isSuperAdmin: boolean;
    summary?: {
      countryName?: string;
      branchDisplayName?: string;
      branchName?: string;
    };
  };
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function cleanDate(val: string | null | undefined): string {
  if (!val) return "-";
  if (val.includes("T")) return val.split("T")[0];
  if (val.includes(" ")) return val.split(" ")[0];
  return val;
}

function entrySerial(row: ReportRow): string {
  return (
    row.super_admin_serial_number ||
    row.entry_serial_number ||
    row.country_transaction_serial_number ||
    row.branch_transaction_serial_number ||
    row.voucher_no ||
    "-"
  );
}

function formatEntryType(val: string | null | undefined): string {
  if (!val) return "-";
  return val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtNumber(value: number | string | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function branchName(row: ReportRow) {
  return row.city_branches?.name ?? row.country_branches?.name ?? "-";
}

function billNumber(row: ReportRow) {
  return row.source_reference_no || row.reference_no || "-";
}

function primaryLine(row: ReportRow): ReportLine | undefined {
  return row.roznamcha_lines?.[0];
}

function printReportTable(opts: { title: string; subtitle: string; rows: ReportRow[]; totals: { debit: number; credit: number }; lang: SupportedLanguage }) {
  if (typeof window === "undefined") return;
  const win = window.open("", "_blank", "width=1300,height=800");
  if (!win) return;

  const bodyRows = opts.rows
    .map((row, idx) => {
      const line = primaryLine(row);
      const debit = Number(line?.debit || 0);
      const credit = Number(line?.credit || 0);
      return `<tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td style="text-align:center;">${cleanDate(row.entry_date || row.created_at)}</td>
        <td style="text-align:center;font-weight:bold;">${entrySerial(row)}</td>
        <td>${row.countries?.name ?? "-"}</td>
        <td>${branchName(row)}</td>
        <td>${row.profiles?.full_name ?? "-"}</td>
        <td>${formatEntryType(row.source_transaction_type || row.type)}</td>
        <td>${getCategoryLabel(row.entry_category, opts.lang)}</td>
        <td style="font-family:monospace;">${line?.account_number || line?.ledgers?.code || "-"}</td>
        <td style="font-weight:bold;">${line?.ledgers?.name ?? "-"}</td>
        <td>${(row.narration ?? "-").slice(0, 80)}</td>
        <td style="text-align:center;font-weight:bold;">${line?.currency ?? row.countries?.currency_code ?? "-"}</td>
        <td class="num">${debit ? fmtNumber(debit) : "-"}</td>
        <td class="num">${credit ? fmtNumber(credit) : "-"}</td>
        <td class="num">${fmtNumber(credit - debit)}</td>
        <td style="text-align:center;font-family:monospace;">${billNumber(row)}</td>
        <td style="text-align:center;">${row.status}</td>
      </tr>`;
    })
    .join("");

  win.document.write(`<!doctype html><html dir="${["ur", "ar", "fa", "ps"].includes(opts.lang) ? "rtl" : "ltr"}" lang="${opts.lang}"><head><title>${opts.title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; color: #111; }
      h1 { font-size: 18px; margin-bottom: 2px; }
      p.sub { color: #555; margin-top: 0; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 10px; }
      th, td { border: 1px solid #ccc; padding: 4px 5px; text-align: left; }
      th { background: #0f172a; color: #fff; text-align: center; font-size: 10px; }
      td.num { text-align: right; font-family: monospace; }
      tfoot td { font-weight: bold; background: #f1f5f9; }
    </style>
  </head><body>
    <h1>${opts.title}</h1>
    <p class="sub">${opts.subtitle}</p>
    <table>
      <thead><tr>
        <th>${t(opts.lang, "rozrep.sno", "S.No")}</th><th>${t(opts.lang, "rozrep.date", "Date")}</th><th>${t(opts.lang, "rozrep.entry_serial", "Entry Serial")}</th><th>${t(opts.lang, "rozrep.country", "Country")}</th><th>${t(opts.lang, "rozrep.branch", "Branch")}</th><th>${t(opts.lang, "rozrep.user", "User")}</th>
        <th>${t(opts.lang, "rozrep.entry_type", "Entry Type")}</th><th>${t(opts.lang, "rozrep.roznamcha_type", "Roznamcha Type")}</th><th>${t(opts.lang, "rozrep.account_no", "Account No")}</th><th>${t(opts.lang, "rozrep.account_name", "Account Name")}</th><th>${t(opts.lang, "rozrep.narration", "Narration / Remarks")}</th>
        <th>${t(opts.lang, "rozrep.currency", "Currency")}</th><th>${t(opts.lang, "rozrep.debit", "Debit")}</th><th>${t(opts.lang, "rozrep.credit", "Credit")}</th><th>${t(opts.lang, "rozrep.balance", "Balance")}</th><th>${t(opts.lang, "rozrep.bill_ref", "Bill/Ref No")}</th><th>${t(opts.lang, "rozrep.status", "Status")}</th>
      </tr></thead>
      <tbody>${bodyRows}</tbody>
      <tfoot><tr>
        <td colspan="12">${t(opts.lang, "rozrep.totals", "Totals")}</td>
        <td class="num">${fmtNumber(opts.totals.debit)}</td>
        <td class="num">${fmtNumber(opts.totals.credit)}</td>
        <td class="num">${fmtNumber(opts.totals.credit - opts.totals.debit)}</td>
        <td colspan="2"></td>
      </tr></tfoot>
    </table>
  </body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

export function RoznamchaTypeReportView({
  lang,
  pageTitle,
  entryCategory
}: {
  lang: SupportedLanguage;
  pageTitle: string;
  entryCategory: RoznamchaEntryCategory | "all";
}) {
  const router = useRouter();
  const activeLang = useActiveLanguage();
  const currentLang = activeLang || lang;
  // Central i18n shorthand (keys live in lib/i18n/ui.ts with all 5 languages).
  const tt = (key: string, fallback: string) => t(currentLang, key as never, fallback);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);
  const [titleSlot, setTitleSlot] = useState<HTMLElement | null>(null);

  const [fromDate, setFromDate] = useState(monthStartIso());
  const [toDate, setToDate] = useState(todayIso());
  const [countryId, setCountryId] = useState<string>("all");
  const [branchId, setBranchId] = useState<string>("all");
  const [debitCredit, setDebitCredit] = useState<string>("all");
  const [currency, setCurrency] = useState<string>("all");
  const [referenceNo, setReferenceNo] = useState("");
  const [billNo, setBillNo] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<RoznamchaEntryCategory | "all">(entryCategory);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("entry_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setActionsSlot(document.getElementById("erp-page-actions-slot"));
    setTitleSlot(document.getElementById("erp-page-title-slot"));
  }, []);

  async function fetchSessionInfo() {
    return apiGet<SessionInfo>("/api/erp/auth/session");
  }

  async function loadData() {
    setLoading(true);
    try {
      let info = sessionInfo;
      if (!info) {
        info = await fetchSessionInfo();
        setSessionInfo(info);
      }

      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.set("entryCategory", selectedCategory);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (!info?.scopes?.isSuperAdmin) {
        if (info?.scopes?.countryIds?.[0]) params.set("countryId", info.scopes.countryIds[0]);
        if (info?.scopes?.cityBranchIds?.[0]) params.set("cityBranchId", info.scopes.cityBranchIds[0]);
        else if (info?.scopes?.countryBranchIds?.[0]) params.set("countryBranchId", info.scopes.countryBranchIds[0]);
      } else {
        if (countryId !== "all") params.set("countryId", countryId);
        if (branchId !== "all") params.set("cityBranchId", branchId);
      }
      if (debitCredit !== "all") params.set("debitCredit", debitCredit);
      if (currency !== "all") params.set("currency", currency);
      if (referenceNo.trim()) params.set("referenceNo", referenceNo.trim());
      if (billNo.trim()) params.set("billNo", billNo.trim());
      if (status !== "all") params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await apiGet<ReportResponse>(`/api/erp/roznamcha/reports?${params.toString()}`);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    const handleSaved = () => void loadData();
    window.addEventListener("erp:posting-saved", handleSaved);
    window.addEventListener("erp:posting-deleted", handleSaved);
    return () => {
      window.removeEventListener("erp:posting-saved", handleSaved);
      window.removeEventListener("erp:posting-deleted", handleSaved);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, fromDate, toDate, countryId, branchId, debitCredit, currency, status, sortBy, sortDir, page, pageSize]);

  function applySearch() {
    setPage(1);
    void loadData();
  }

  function resetFilters() {
    setFromDate(monthStartIso());
    setToDate(todayIso());
    setCountryId("all");
    setBranchId("all");
    setDebitCredit("all");
    setCurrency("all");
    setReferenceNo("");
    setBillNo("");
    setStatus("all");
    setQ("");
    setPage(1);
  }

  const rows = data?.entries ?? [];

  const currencyOptions: SearchSelectOption[] = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const c = primaryLine(row)?.currency;
      if (c) set.add(c);
    }
    return Array.from(set).map((c) => ({ value: c, label: c }));
  }, [rows]);

  function exportCsv() {
    const header = [
      "S.No",
      "Date",
      "Entry Serial",
      "Country",
      "Branch",
      "User",
      "Entry Type",
      "Roznamcha Type",
      "Account No",
      "Account Name",
      "Narration / Remarks",
      "Currency",
      "Debit",
      "Credit",
      "Balance",
      "Bill/Reference No",
      "Posting Status"
    ];
    const csvRows = rows.map((row, idx) => {
      const line = primaryLine(row);
      const debit = Number(line?.debit || 0);
      const credit = Number(line?.credit || 0);
      return [
        String(idx + 1 + (page - 1) * pageSize),
        cleanDate(row.entry_date || row.created_at),
        entrySerial(row),
        row.countries?.name ?? "-",
        branchName(row),
        row.profiles?.full_name ?? "-",
        formatEntryType(row.source_transaction_type || row.type),
        getCategoryLabel(row.entry_category, activeLang),
        line?.account_number || line?.ledgers?.code || "-",
        line?.ledgers?.name ?? "-",
        row.narration ?? "",
        line?.currency ?? row.countries?.currency_code ?? "-",
        debit ? String(debit) : "0.00",
        credit ? String(credit) : "0.00",
        String(credit - debit),
        billNumber(row),
        row.status
      ];
    });
    const csv = [header, ...csvRows].map((r) => r.map((c) => csvEscape(String(c ?? ""))).join(",")).join("\r\n");
    downloadTextFile(`roznamcha-${entryCategory}-report-${todayIso()}.csv`, csv, "text/csv");
  }

  function printReport() {
    printReportTable({
      title: pageTitle,
      subtitle: `${fromDate} to ${toDate} · Generated ${new Date().toLocaleString()}`,
      rows,
      totals: { debit: data?.totalDebit ?? 0, credit: data?.totalCredit ?? 0 },
      lang: activeLang
    });
  }

  function toggleSort(column: string) {
    if (sortBy === column) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
  }

  return (
    <div className="w-full space-y-3 text-foreground animate-in fade-in duration-200">
      {/* Top Standard ERP Report Toolbar Strip (Matches exact UI design) */}
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
            Back
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
            {filtersOpen ? "Hide Filters" : "Search / Filters"}
          </Button>

          {/* Live Search Input */}
          <div className="relative min-w-[140px] sm:min-w-[180px]">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
              placeholder={tt("rozrep.filter_entries_ph", "Filter entries...")}
              className="h-7 pl-7 pr-6 text-[11px] rounded-lg border-slate-200 bg-slate-50 focus-visible:bg-white dark:border-slate-700 dark:bg-slate-800 dark:focus-visible:bg-slate-900"
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setTimeout(applySearch, 50);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Reload / Refresh Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-7 gap-1 rounded-lg border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCcw className={cn("h-3 w-3", loading && "animate-spin")} />
            Reload
          </Button>
        </div>

        {/* Action Dropdown Menu */}
        <div className="relative">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setActionsMenuOpen((v: boolean) => !v)}
            className="h-7 gap-1 rounded-lg border-blue-200 bg-blue-50/50 px-2.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400"
          >
            <MoreVertical className="h-3 w-3" />
            Actions
          </Button>
          {actionsMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setActionsMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[170px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    printReport();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <Printer className="h-3.5 w-3.5 text-blue-600" />
                  Print / PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionsMenuOpen(false);
                    exportCsv();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <DownloadActionIcon className="h-3.5 w-3.5 text-emerald-600" />
                  Export to CSV
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Top 4 KPI Analytics Cards (Matches exact ERP screenshot layout) */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Branch & User Details */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-blue-50/60 dark:bg-blue-900/15">
            <div className="bg-blue-600 p-1 rounded-full text-white flex-shrink-0">
              <Users className="h-3 w-3" />
            </div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-blue-800 dark:text-blue-400">
              1. BRANCH & USER DETAILS
            </h4>
          </div>
          <div className="p-3 flex flex-col gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>{tt("rozrep.country_label", "COUNTRY:")}</span>
              <span className="font-black text-slate-800 dark:text-slate-200">
                {sessionInfo?.scopes?.summary?.countryName ?? "United Arab Emirates"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tt("rozrep.branch_name_label", "BRANCH NAME:")}</span>
              <span className="font-black text-slate-800 dark:text-slate-200">
                {sessionInfo?.scopes?.summary?.branchDisplayName ?? sessionInfo?.scopes?.summary?.branchName ?? "UNITED ARAB EMIRATES MAIN BRANCH"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tt("rozrep.user_id_label", "USER ID:")}</span>
              <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300">
                {sessionInfo?.user?.id ?? "90902409-5512-47d1-8612-3095f2285406"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tt("rozrep.user_name_label", "USER NAME:")}</span>
              <span className="font-black text-slate-800 dark:text-slate-200">
                {sessionInfo?.user?.fullName ?? "SUPER ADMIN"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tt("rozrep.role_label", "ROLE:")}</span>
              <span className="font-black text-blue-600 dark:text-blue-400 uppercase">
                {sessionInfo?.roles?.[0] ?? "SUPER ADMIN"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tt("rozrep.datetime_label", "DATE & TIME:")}</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })},{" "}
                {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
              </span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px]">
              <span>{tt("rozrep.status_label", "STATUS:")}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{tt("rozrep.active", "ACTIVE")}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Global Financial Summary */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/60 dark:bg-emerald-900/15">
            <div className="bg-emerald-600 p-1 rounded-full text-white flex-shrink-0">
              <DollarSign className="h-3 w-3" />
            </div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              2. GLOBAL FINANCIAL SUMMARY
            </h4>
          </div>
          <div className="p-3 flex flex-col gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>{tt("rozrep.total_global_entries", "TOTAL GLOBAL ENTRIES:")}</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{data?.totalCount ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>TOTAL CREDIT (AED):</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">{fmtNumber(data?.totalCredit ?? 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-600 dark:text-rose-400">TOTAL DEBIT (AED):</span>
              <span className="font-black text-rose-600 dark:text-rose-400 font-mono">{fmtNumber(data?.totalDebit ?? 0)}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <span className="text-slate-700 dark:text-slate-300 font-bold">BALANCE (AED):</span>
              <span className="font-black text-blue-600 dark:text-blue-400 font-mono text-sm">{fmtNumber(data?.netBalance ?? 0)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Bill Entries Summary */}
        <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-purple-50/60 dark:bg-purple-900/15">
            <div className="bg-purple-600 p-1 rounded-full text-white flex-shrink-0">
              <Receipt className="h-3 w-3" />
            </div>
            <h4 className="text-[11px] font-black uppercase tracking-wider text-purple-800 dark:text-purple-400">
              3. BILL ENTRIES SUMMARY
            </h4>
          </div>
          <div className="p-3 flex flex-col gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 h-full">
            <div className="flex justify-between items-center">
              <span>{tt("rozrep.total_bill_entries", "TOTAL BILL ENTRIES:")}</span>
              <span className="font-black text-slate-800 dark:text-slate-200">{data?.totalCount ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>{tt("rozrep.cleared_entries", "CLEARED ENTRIES:")}</span>
              <span className="font-black text-emerald-600 dark:text-emerald-400">{data?.postedCount ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-rose-600">{tt("rozrep.remaining_entries", "REMAINING ENTRIES:")}</span>
              <span className="font-black text-rose-600">{data?.pendingCount ?? 0}</span>
            </div>
            <div className="flex justify-between items-center mt-auto pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[10px]">
              <span>{tt("rozrep.system_status", "SYSTEM STATUS:")}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{tt("rozrep.online_synced", "ONLINE & SYNCED")}</span>
            </div>
          </div>
        </div>

        {/* Card 4: All Categories Breakdown */}
        <button
          type="button"
          onClick={() => setShowAllCategories(!showAllCategories)}
          className={cn(
            "flex flex-col rounded-xl border transition-all duration-200 text-left overflow-hidden h-full group",
            showAllCategories
              ? "border-orange-500 bg-orange-50/30 shadow-md dark:border-orange-500/50 dark:bg-orange-950/20"
              : "border-slate-200 bg-white shadow-xs hover:border-orange-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
          )}
        >
          <div className={cn(
            "flex items-center justify-between px-3 py-2 border-b w-full transition-colors",
            showAllCategories
              ? "border-orange-200 bg-orange-100/50 dark:border-orange-900/50 dark:bg-orange-900/30"
              : "border-slate-100 bg-orange-50/60 dark:border-slate-800 dark:bg-orange-900/15"
          )}>
            <div className="flex items-center gap-2">
              <div className="bg-orange-600 p-1 rounded-full text-white flex-shrink-0">
                <Globe2 className="h-3 w-3" />
              </div>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-orange-800 dark:text-orange-400">
                4. ALL COUNTRIES REPORT
              </h4>
            </div>
            <ChevronDown className={cn("h-3.5 w-3.5 text-orange-600 transition-transform duration-200", showAllCategories ? "rotate-180" : "")} />
          </div>
          <div className="p-3 flex flex-col justify-between h-full w-full">
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                Active Types: <span className="font-extrabold text-orange-600">5 Categories</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                Current Filter: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedCategory === "all" ? "All Categories" : getCategoryLabel(selectedCategory, activeLang)}</span>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-orange-600 group-hover:underline">
                {showAllCategories ? "Hide Details" : "Show Details"}
              </span>
              <span className="text-[9px] font-bold text-orange-600 bg-orange-100/80 dark:bg-orange-950/60 px-1.5 py-0.5 rounded">
                EXPLORE →
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Expanded Breakdown Directory */}
      {showAllCategories ? (
        <div className="rounded-xl border border-orange-200 bg-orange-50/40 p-3.5 dark:border-orange-900/50 dark:bg-orange-950/20 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-orange-900 dark:text-orange-300">
              Roznamcha Entry Category Directory
            </h3>
            <span className="text-[10px] text-orange-700 dark:text-orange-400">
              Click a category to filter instantly
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {(["cash", "bank", "invoice", "transfer", "business"] as RoznamchaEntryCategory[]).map((cat) => (
              <div
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setPage(1);
                }}
                className={cn(
                  "cursor-pointer rounded-xl border p-2.5 transition-all hover:shadow-md",
                  selectedCategory === cat
                    ? "border-orange-500 bg-orange-100/70 dark:border-orange-400 dark:bg-orange-900/40 font-bold"
                    : "border-white/80 bg-white/90 dark:border-slate-800 dark:bg-slate-900/80"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase">{getCategoryLabel(cat, activeLang)}</span>
                  <span className="text-[10px] font-mono text-slate-400">#{cat}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                  {selectedCategory === cat ? "Active View" : "Click to view"}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Collapsible Search & Filter Panel */}
      {filtersOpen ? (
        <Card className="border-slate-200/80 shadow-xs animate-in fade-in slide-in-from-top-2">
          <CardContent className="p-3.5 space-y-3">
            <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">{tt("rozrep.from_date", "From Date")}</Label>
                <Input className="h-8 text-xs" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">{tt("rozrep.to_date", "To Date")}</Label>
                <Input className="h-8 text-xs" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              {entryCategory === "all" ? (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">{tt("rozrep.entry_type", "Entry Type")}</Label>
                  <select
                    className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as RoznamchaEntryCategory | "all")}
                  >
                    <option value="all">{tt("rozrep.all_types", "All Types")}</option>
                    {(["business", "bank", "cash", "invoice", "transfer"] as RoznamchaEntryCategory[]).map((value) => (
                      <option key={value} value={value}>{getCategoryLabel(value, activeLang)}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">{tt("rozrep.debit_credit", "Debit / Credit")}</Label>
                <select
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  value={debitCredit}
                  onChange={(e) => setDebitCredit(e.target.value)}
                >
                  <option value="all">{tt("rozrep.all", "All")}</option>
                  <option value="debit">{tt("rozrep.debit", "Debit")}</option>
                  <option value="credit">{tt("rozrep.credit", "Credit")}</option>
                </select>
              </div>
              <SearchSelect
                label="Currency"
                value={currency}
                placeholder={tt("rozrep.all", "All")}
                options={[{ value: "all", label: "All" }, ...currencyOptions]}
                onValueChange={setCurrency}
              />
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">{tt("rozrep.status", "Status")}</Label>
                <select
                  className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">{tt("rozrep.all", "All")}</option>
                  <option value="draft">{tt("rozrep.draft", "Draft")}</option>
                  <option value="posted">{tt("rozrep.posted", "Posted")}</option>
                  <option value="transferred">{tt("rozrep.transferred", "Transferred")}</option>
                  <option value="cancelled">{tt("rozrep.cancelled", "Cancelled")}</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">{tt("rozrep.reference_no", "Reference No")}</Label>
                <Input className="h-8 text-xs" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder={tt("rozrep.reference_ph", "Reference number")} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Bill No</Label>
                <Input className="h-8 text-xs" value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="Bill number" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" className="h-7 text-xs" onClick={applySearch} disabled={loading}>Apply</Button>
              <Button type="button" size="sm" variant="secondary" className="h-7 text-xs" onClick={resetFilters} disabled={loading}>Reset</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Data Table */}
      <Card className="border-slate-200/80 shadow-xs">
        <CardHeader className="py-2 px-3 flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Total Entries: <span className="font-extrabold text-blue-600 dark:text-blue-400">{data?.totalCount ?? 0}</span>
          </CardTitle>
          <div className="text-[10.5px] font-semibold text-slate-500">
            Showing Page {page} of {Math.ceil((data?.totalCount ?? 0) / pageSize) || 1}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] border-collapse text-xs">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <ReportTh>{tt("rozrep.sno", "S.No")}</ReportTh>
                  <th
                    className="p-2.5 text-center font-bold cursor-pointer select-none hover:bg-slate-800 whitespace-nowrap"
                    onClick={() => toggleSort("entry_date")}
                  >
                    {tt("rozrep.date", "Date")} {sortBy === "entry_date" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                  </th>
                  <ReportTh>{tt("rozrep.entry_serial", "Entry Serial")}</ReportTh>
                  <ReportTh>{tt("rozrep.country", "Country")}</ReportTh>
                  <ReportTh>{tt("rozrep.branch", "Branch")}</ReportTh>
                  <ReportTh>{tt("rozrep.user", "User")}</ReportTh>
                  <ReportTh>{tt("rozrep.entry_type", "Entry Type")}</ReportTh>
                  <ReportTh>{tt("rozrep.roznamcha_type", "Roznamcha Type")}</ReportTh>
                  <ReportTh>{tt("rozrep.account_no", "Account No")}</ReportTh>
                  <ReportTh className="text-start">{tt("rozrep.account_name", "Account Name")}</ReportTh>
                  <ReportTh className="text-start">{tt("rozrep.narration", "Narration / Remarks")}</ReportTh>
                  <ReportTh>{tt("rozrep.currency", "Currency")}</ReportTh>
                  <ReportTh className="text-right">{tt("rozrep.debit", "Debit")}</ReportTh>
                  <ReportTh className="text-right">{tt("rozrep.credit", "Credit")}</ReportTh>
                  <ReportTh className="text-right">{tt("rozrep.balance", "Balance")}</ReportTh>
                  <ReportTh>{tt("rozrep.bill_ref", "Bill/Ref No")}</ReportTh>
                  <ReportTh>{tt("rozrep.status", "Status")}</ReportTh>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={17} className="p-8 text-center text-sm text-muted-foreground">Loading Entries...</td></tr>
                ) : rows.length ? (
                  rows.map((row, idx) => {
                    const line = primaryLine(row);
                    const debit = Number(line?.debit || 0);
                    const credit = Number(line?.credit || 0);
                    return (
                      <tr key={row.id} className={cn("border-t hover:bg-muted/40", idx % 2 ? "bg-muted/10" : "bg-background")}>
                        <ReportTd className="text-center font-mono">{idx + 1 + (page - 1) * pageSize}</ReportTd>
                        <ReportTd className="text-center font-mono whitespace-nowrap font-medium">
                          {cleanDate(row.entry_date || row.created_at)}
                        </ReportTd>
                        <ReportTd className="text-center font-mono font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {entrySerial(row)}
                        </ReportTd>
                        <ReportTd className="text-center whitespace-nowrap">{row.countries?.name ?? "-"}</ReportTd>
                        <ReportTd className="text-center whitespace-nowrap">{branchName(row)}</ReportTd>
                        <ReportTd className="text-center whitespace-nowrap">{row.profiles?.full_name ?? "-"}</ReportTd>
                        <ReportTd className="text-center whitespace-nowrap font-medium text-[11px]">
                          {formatEntryType(row.source_transaction_type || row.type)}
                        </ReportTd>
                        <ReportTd className="text-center whitespace-nowrap font-semibold">
                          {getCategoryLabel(row.entry_category, currentLang)}
                        </ReportTd>
                        <ReportTd className="text-center font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {line?.account_number || line?.ledgers?.code || "-"}
                        </ReportTd>
                        <ReportTd className="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {line?.ledgers?.name ?? "-"}
                        </ReportTd>
                        <ReportTd className="text-start max-w-[240px] truncate text-slate-600 dark:text-slate-300">
                          <span title={row.narration || ""}>{row.narration || "-"}</span>
                        </ReportTd>
                        <ReportTd className="text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                          {line?.currency ?? row.countries?.currency_code ?? "-"}
                        </ReportTd>
                        <ReportTd className="text-right font-mono font-bold text-rose-600">{debit ? fmtNumber(debit) : "-"}</ReportTd>
                        <ReportTd className="text-right font-mono font-bold text-emerald-600">{credit ? fmtNumber(credit) : "-"}</ReportTd>
                        <ReportTd className="text-right font-mono font-bold">{fmtNumber(credit - debit)}</ReportTd>
                        <ReportTd className="text-center font-mono text-[11px] whitespace-nowrap">{billNumber(row)}</ReportTd>
                        <ReportTd className="text-center whitespace-nowrap">
                          <span className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                            row.status === "posted"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/40"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-300/40"
                          )}>
                            {row.status}
                          </span>
                        </ReportTd>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={17} className="p-8 text-center text-sm text-muted-foreground">No entries found for the selected filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="p-2.5 border-t border-slate-100 dark:border-slate-800">
            <ReportPagination
              page={page}
              pageSize={pageSize}
              totalCount={data?.totalCount ?? 0}
              onPageChange={setPage}
              onPageSizeChange={(sz) => {
                setPageSize(sz);
                setPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
