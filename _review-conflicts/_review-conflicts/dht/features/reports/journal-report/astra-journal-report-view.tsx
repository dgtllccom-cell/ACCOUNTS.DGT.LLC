"use client";

import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Building2,
  CalendarDays,
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
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CashEntryForm } from "@/features/roznamcha/components/cash-entry-form";
import { cn } from "@/lib/utils";
import type { RoznamchaType } from "@/lib/accounting/roznamcha-flow";
import type { SupportedLanguage } from "@/lib/i18n/languages";
import { openA4ReportWindow } from "@/lib/reports/open-a4-report-window";
import { Mail } from "lucide-react";
import { useSearchParams } from "next/navigation";

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
  cityBranchName: string | null;
  companyName: string | null;
  status: "active" | "inactive";
  entries: number;
  debit: number;
  credit: number;
  balance: number;
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

const sampleRows: JournalRow[] = [
  {
    id: "sample-1",
    voucherNo: "JV-0001",
    accountNumber: "AC-0001",
    accountName: "Construction Material",
    date: "2026-06-01",
    endDate: "2026-06-01",
    country: "Pakistan",
    city: "Quetta",
    branch: "Quetta Main Branch",
    branchCode: "QTA-MAIN",
    project: "Warehouse Expansion",
    site: "Site A",
    contractor: "Damaan Contractors",
    voucherType: "Material Journal",
    txType: "Debit",
    account: "Construction Material",
    narration: "Steel and cement material posting",
    currency: "PKR",
    debit: 250000,
    credit: 0,
    balance: 250000,
    trend: "Increase",
    status: "Active",
    entries: 10
  },
  {
    id: "sample-2",
    voucherNo: "JV-0002",
    accountNumber: "AC-0002",
    accountName: "Labour Cost",
    date: "2026-06-02",
    endDate: "2026-06-02",
    country: "Pakistan",
    city: "Chaman",
    branch: "Chaman City Branch",
    branchCode: "CH-CITY",
    project: "Cold Storage",
    site: "Site B",
    contractor: "Asmat Builders",
    voucherType: "Labour Journal",
    txType: "Debit",
    account: "Labour Cost",
    narration: "Weekly labour payment",
    currency: "PKR",
    debit: 85000,
    credit: 20000,
    balance: 65000,
    trend: "Increase",
    status: "Active",
    entries: 5
  }
];

function fmt(value: number) {
  return Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateDisplay(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB");
}

function normalize(value: unknown) {
  return String(value ?? "").toLowerCase().trim();
}

function csvEscape(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function exportCsv(rows: JournalRow[], scope: JournalScope) {
  const headers = ["Serial No", "Account Number", "Account Name", "Branch Name", "Entries Today", "Total Debit", "Total Credit"];
  const body = rows.map((row, index) =>
    [
      index + 1,
      row.accountNumber,
      row.accountName,
      row.branch,
      row.entries ?? 0,
      fmt(row.debit),
      fmt(row.credit)
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
    return {
      id: row.ledgerId,
      voucherNo: row.lastReferenceNo || `JV-${String(index + 1).padStart(4, "0")}`,
      accountNumber: row.accountCode || row.ledgerCode || "-",
      accountName,
      date: row.lastEntryDate || new Date().toISOString().slice(0, 10),
      endDate: row.lastEntryDate || new Date().toISOString().slice(0, 10),
      country: row.countryName || "-",
      city,
      branch: row.cityBranchName || row.countryBranchName || "-",
      branchCode: "-",
      project: scope === "construction" ? row.companyName || "General Project" : "-",
      site: scope === "construction" ? row.cityBranchName || row.countryBranchName || "Main Site" : "-",
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

function titleFor(scope: JournalScope) {
  if (scope === "country") return "Country Journal Report";
  if (scope === "city") return "City Journal Report";
  return "Construction Journal Report";
}

function paymentConfigFor(scope: JournalScope): { postingType: RoznamchaType; scopeMode: "super_admin" | "country" | "branch" } {
  if (scope === "country") return { postingType: "country", scopeMode: "country" };
  if (scope === "city") return { postingType: "branch", scopeMode: "branch" };
  return { postingType: "super_admin", scopeMode: "super_admin" };
}

export function AstraJournalReportView({ lang, scope }: { lang: SupportedLanguage; scope: JournalScope }) {
  const searchParams = useSearchParams();
  const urlCountry = searchParams?.get("country") || "";

  const todayStr = new Date().toISOString().slice(0, 10);
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [entryOpen, setEntryOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draftStatus, setDraftStatus] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      setRows(mapped.length ? mapped : sampleRows);
      setGeneratedAt(body.generatedAt || new Date().toISOString());
      if (!mapped.length) setMessage("No live journal vouchers found. Showing preview rows until entries are posted.");
    } catch (error) {
      setRows(sampleRows);
      setGeneratedAt(new Date().toISOString());
      setMessage(error instanceof Error ? error.message : "Journal report API unavailable. Showing preview rows.");
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
  }

  function sort(column: keyof JournalRow) {
    if (sortKey === column) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(column);
      setSortDir("asc");
    }
  }

  function openPrint(autoPrint: boolean) {
    openA4ReportWindow({
      title: titleFor(scope),
      subtitle: `Generated: ${generatedAt ? new Date(generatedAt).toLocaleString() : new Date().toLocaleString()}`,
      rows: [
        { label: "Report Type", value: titleFor(scope) },
        { label: "Date Range", value: `${fromDate} to ${toDate}` },
        { label: "Total Accounts in Branch", value: String(summary.accounts) },
        { label: "Active Accounts", value: String(summary.active) },
        { label: "Credit Accounts", value: String(summary.creditAccounts) },
        { label: "Debit Accounts", value: String(summary.debitAccounts) },
        { label: "Total Credit", value: fmt(summary.credit) },
        { label: "Total Debit", value: fmt(summary.debit) },
        { label: "Final Balance", value: fmt(summary.balance) }
      ],
      autoPrint,
      lang
    });
  }

  function emailReport() {
    const subject = encodeURIComponent(`${titleFor(scope)} - Summary`);
    const body = encodeURIComponent(`Please find the summary of the ${titleFor(scope)}:\n\nDate Range: ${fromDate} to ${toDate}\nTotal Accounts: ${summary.accounts}\nActive Accounts: ${summary.active}\nTotal Credit: ${fmt(summary.credit)}\nTotal Debit: ${fmt(summary.debit)}\nFinal Balance: ${fmt(summary.balance)}\n\nBest regards,\nERP Management System`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 px-3 py-4 md:px-5 bg-[#f8fafc] dark:bg-slate-950 min-h-screen font-sans">
      
      {/* Header Section */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Logo Placeholder */}
          <div className="flex flex-col items-center justify-center text-blue-900 dark:text-blue-500">
            <div className="text-3xl font-black tracking-tighter flex items-center">
              DHT
              <div className="w-2 h-2 rounded-full bg-emerald-500 ml-1 mb-3"></div>
            </div>
            <div className="text-[9px] font-bold tracking-widest text-slate-500 uppercase mt-[-4px]">
              ERP System
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-black tracking-tight text-[#0f2942] dark:text-slate-100 uppercase">
            {scope === "country" ? "COUNTRY ADMIN REPORT" : "General Ledger Report"}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <div className="h-px w-12 bg-slate-300 dark:bg-slate-700"></div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {scope === "country" ? "Complete Financial Summary by Branches" : "Country & City Branch Consolidated"}
            </p>
            <div className="h-px w-12 bg-slate-300 dark:bg-slate-700"></div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="bg-blue-800 hover:bg-blue-900 text-white font-bold text-xs h-9 px-4 rounded-md shadow-sm"
              onClick={() => openPrint(true)}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print Report
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="font-bold text-xs h-9 px-4 rounded-md border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300 shadow-sm bg-white dark:bg-slate-900"
              onClick={() => exportCsv(filtered, scope)}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
            {/* Hidden Filter button for functionality */}
            <Button
              size="sm"
              variant="outline"
              className="font-bold text-xs h-9 px-3 rounded-md border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300 shadow-sm bg-white dark:bg-slate-900"
              onClick={() => setFiltersOpen((o) => !o)}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Report Date & Time</p>
            <p className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase">
              {generatedAt ? new Date(generatedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
            </p>
          </div>
        </div>
      </div>

      {filtersOpen ? (
        <div className="grid gap-2 rounded-xl border border-border bg-white dark:bg-slate-900 p-4 shadow-sm md:grid-cols-3 xl:grid-cols-6 mb-4">
          <Select label="Country" value={country} options={options.countries} onChange={setCountry} />
          {scope !== "country" ? <Select label="City" value={city} options={options.cities} onChange={setCity} /> : null}
          <Select label="Branch" value={branch} options={options.branches} onChange={setBranch} />
          {scope === "construction" ? <Select label="Project" value={project} options={options.projects} onChange={setProject} /> : null}
          {scope === "construction" ? <Select label="Site" value={site} options={options.sites} onChange={setSite} /> : null}
          {scope === "construction" ? <Select label="Contractor" value={contractor} options={options.contractors} onChange={setContractor} /> : null}
          <DateInput label="From Date" value={fromDate} onChange={setFromDate} />
          <DateInput label="To Date" value={toDate} onChange={setToDate} />
        </div>
      ) : null}

      {/* Details Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <DetailBox 
          title="COUNTRY DETAILS" 
          icon={<div className="h-4 w-4 rounded-full border-2 border-blue-600/50 flex items-center justify-center"><div className="h-1.5 w-1.5 rounded-full bg-blue-600"></div></div>}
          items={[
            { label: "Country Name", value: "Pakistan", hasFlag: true },
            { label: "Country Code", value: "PK" },
            { label: "Currency", value: "PKR - Pakistan Rupee" }
          ]}
        />
        {scope === "country" ? (
          <DetailBox 
            title="ADMIN DETAILS" 
            icon={<span className="text-blue-600 text-sm">👤</span>}
            items={[
              { label: "Admin Name", value: "Admin Chaman" },
              { label: "User Role", value: "Country Admin" },
              { label: "User ID", value: "CHAMAN@DGT.LLC" }
            ]}
          />
        ) : (
          <DetailBox 
            title="BRANCH DETAILS" 
            icon={<Building2 className="h-4 w-4 text-blue-600" />}
            items={[
              { label: "Branch (City)", value: "CHAMAN BRANCH" },
              { label: "Branch Code", value: "CHM-001" },
              { label: "Branch Type", value: "CITY BRANCH" }
            ]}
          />
        )}
        {scope === "country" ? (
          <DetailBox 
            title="REPORT DETAILS" 
            icon={<CalendarDays className="h-4 w-4 text-blue-600" />}
            items={[
              { label: "From Date", value: new Date(fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) },
              { label: "To Date", value: new Date(toDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) },
              { label: "Report Type", value: "COUNTRY ADMIN REPORT" }
            ]}
          />
        ) : (
          <DetailBox 
            title="USER DETAILS" 
            icon={<span className="text-blue-600 text-sm">👤</span>}
            items={[
              { label: "User Name", value: "ADMIN CHAMAN" },
              { label: "User Role", value: "City Branch Admin" },
              { label: "User ID", value: "CHAMAN@DGT.LLC" }
            ]}
          />
        )}
        {scope === "country" ? (
          <DetailBox 
            title="SUMMARY OVERVIEW" 
            icon={<ClipboardList className="h-4 w-4 text-blue-600" />}
            items={[
              { label: "Total Branches", value: String(Array.from(new Set(filtered.map(r => r.branchCode))).length || 4) },
              { label: "Total Transactions", value: String(filtered.length) },
              { label: "Exchange Rate", value: "1 Base Currency = 1 Base Currency" }
            ]}
          />
        ) : (
          <DetailBox 
            title="REPORT DETAILS" 
            icon={<CalendarDays className="h-4 w-4 text-blue-600" />}
            items={[
              { label: "From Date", value: new Date(fromDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) },
              { label: "To Date", value: new Date(toDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) },
              { label: "Report Type", value: "GENERAL LEDGER" },
              { label: "Generated By", value: "ADMIN CHAMAN" }
            ]}
          />
        )}
      </div>

      {/* KPI Section */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 pt-2">
        <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-xl p-4 flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 bg-rose-100 dark:bg-rose-900/50 rounded-lg flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-0.5">TOTAL DEBIT (BASE CURR)</p>
            <p className="text-lg font-black text-rose-600 dark:text-rose-400 tracking-tight">{fmt(summary.debit)}</p>
          </div>
        </div>
        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl p-4 flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-0.5">TOTAL CREDIT (BASE CURR)</p>
            <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 tracking-tight">{fmt(summary.credit)}</p>
          </div>
        </div>
        <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-xl p-4 flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
            <span className="text-blue-600 dark:text-blue-400 font-bold text-lg">⚖</span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-0.5">TOTAL BALANCE (BASE CURR)</p>
            <p className="text-lg font-black text-blue-600 dark:text-blue-400 tracking-tight">{fmt(summary.balance)}</p>
          </div>
        </div>
        <div className="bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/50 rounded-xl p-4 flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center justify-center">
            <span className="text-orange-600 dark:text-orange-400 font-bold text-lg">≡</span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-0.5">TOTAL TRANSACTIONS</p>
            <p className="text-lg font-black text-orange-600 dark:text-orange-400 tracking-tight">{filtered.length}</p>
          </div>
        </div>
        <div className="bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50 rounded-xl p-4 flex items-center gap-4">
          <div className="h-10 w-10 shrink-0 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
            <span className="text-purple-600 dark:text-purple-400 font-bold text-lg">🪙</span>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-0.5">EXCHANGE RATE</p>
            <p className="text-lg font-black text-purple-700 dark:text-purple-400 tracking-tight">1 Base Currency = 1 Base Currency</p>
          </div>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm mt-4 overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#0f2942] dark:text-slate-300" />
            <h2 className="text-[13px] font-black tracking-wider text-[#0f2942] dark:text-slate-200 uppercase">
              {scope === "country" ? "BRANCH WISE SUMMARY" : "LEDGER TRANSACTIONS"}
            </h2>
          </div>
          {scope === "country" && (
            <p className="text-[10px] font-bold text-slate-500">All amounts are in Base Currency</p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-xs text-left whitespace-nowrap">
            <thead className="bg-[#0f2942] text-white">
              {scope === "country" ? (
                <tr>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center w-14 border-r border-white/10">SR. NO.</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">BRANCH NAME</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">BRANCH CODE</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">BRANCH TYPE</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">TOTAL TRANSACTIONS</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">TOTAL DEBIT (BASE CURR)</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">TOTAL CREDIT (BASE CURR)</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">BALANCE (BASE CURR)</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center">STATUS</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center w-14 border-r border-white/10">SR. NO.</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">DATE</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">VOUCHER NO.</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">VOUCHER TYPE</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider border-r border-white/10">ACCOUNT / PARTY</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider border-r border-white/10">DETAILS / NARRATION</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">CURR.</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">DEBIT (BASE CURR)</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">CREDIT (BASE CURR)</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center border-r border-white/10">BALANCE (BASE CURR)</th>
                  <th className="px-3 py-2.5 font-bold text-[10px] uppercase tracking-wider text-center">DR / CR</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={scope === "country" ? 9 : 11} className="px-3 py-8 text-center font-bold text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading report...
                  </td>
                </tr>
              ) : scope === "country" ? (
                Array.from(
                  filtered.reduce((map, row) => {
                    const key = row.branchCode || row.branch || "unknown";
                    if (!map.has(key)) {
                      map.set(key, {
                        branchName: row.branch,
                        branchCode: row.branchCode,
                        branchType: "City Branch",
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
                    }
                    return map;
                  }, new Map<string, any>()).values()
                ).map((branch: any, index: number) => (
                  <tr key={branch.branchCode} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 bg-white dark:bg-slate-900">
                    <td className="px-3 py-4 text-center font-bold text-[#0f2942] dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">
                      {index + 1}
                    </td>
                    <td className="px-3 py-4 text-center font-semibold text-[#0f2942] dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">
                      {branch.branchName}
                    </td>
                    <td className="px-3 py-4 text-center text-[#0f2942] dark:text-slate-400 border-r border-slate-100 dark:border-slate-800 font-mono">
                      {branch.branchCode}
                    </td>
                    <td className="px-3 py-4 text-center text-[#0f2942] dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">
                      {branch.branchType}
                    </td>
                    <td className="px-3 py-4 text-center font-bold text-[#0f2942] dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">
                      {branch.transactions}
                    </td>
                    <td className="px-3 py-4 text-center font-black text-rose-600 dark:text-rose-400 border-r border-slate-100 dark:border-slate-800">
                      {branch.debit > 0 ? fmt(branch.debit) : "0.00"}
                    </td>
                    <td className="px-3 py-4 text-center font-black text-emerald-600 dark:text-emerald-400 border-r border-slate-100 dark:border-slate-800">
                      {branch.credit > 0 ? fmt(branch.credit) : "0.00"}
                    </td>
                    <td className="px-3 py-4 text-center font-black text-[#0f2942] dark:text-blue-400 border-r border-slate-100 dark:border-slate-800">
                      {fmt(branch.balance)}
                    </td>
                    <td className="px-3 py-4 text-center">
                      <span className={cn("px-2 py-1 rounded-full text-[10px] font-bold border", normalize(branch.status) === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-700 border-slate-200")}>
                        {branch.status || "Active"}
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
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 bg-white dark:bg-slate-900">
                      <td className="px-3 py-3 text-center font-bold text-slate-500 border-r border-slate-100 dark:border-slate-800">
                        {(page - 1) * pageSize + index + 1}
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">
                        {new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">
                        {row.voucherNo}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">
                        {scope === "country" ? "Country" : scope === "city" ? "Branch" : "Project"}
                      </td>
                      <td className="px-3 py-3 font-bold text-blue-700 dark:text-blue-400 border-r border-slate-100 dark:border-slate-800">
                        {row.accountNumber ? `${row.accountNumber} - ` : ""}{row.accountName}
                      </td>
                      <td className="px-3 py-3 text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">
                        <span className="truncate max-w-[250px] inline-block align-bottom" title={row.narration}>{row.narration}</span>
                      </td>
                      <td className="px-3 py-3 text-center font-bold text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">
                        BASE CURR
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
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
            {scope === "country" && filtered.length > 0 && !loading && (
              <tfoot className="bg-[#f8fafc] text-[#0f2942] font-black">
                <tr>
                  <td colSpan={4} className="px-3 py-4 uppercase border-r border-slate-200">TOTAL</td>
                  <td className="px-3 py-4 text-center border-r border-slate-200">
                    {Array.from(filtered.reduce((map, row) => {
                      const key = row.branchCode || row.branch || "unknown";
                      if (!map.has(key)) map.set(key, row.entries || 1);
                      else map.set(key, map.get(key) + (row.entries || 1));
                      return map;
                    }, new Map<string, any>()).values()).reduce((a: any, b: any) => a + b, 0)}
                  </td>
                  <td className="px-3 py-4 text-center text-rose-600 border-r border-slate-200">{fmt(summary.debit)}</td>
                  <td className="px-3 py-4 text-center text-emerald-600 border-r border-slate-200">{fmt(summary.credit)}</td>
                  <td className="px-3 py-4 text-center border-r border-slate-200">{fmt(summary.balance)}</td>
                  <td className="px-3 py-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        
        {/* Pagination & Footer note */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-md">
            <div className="h-4 w-4 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-[9px]">i</div>
            NOTE: All amounts are in Base Currency. This report is system generated and does not require any signature.
          </div>
          {scope !== "country" && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="h-8 text-xs font-bold px-3">Prev</Button>
              <span className="text-xs font-black text-slate-700 dark:text-slate-300">Page {page} of {pages}</span>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="h-8 text-xs font-bold px-3">Next</Button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function DetailBox({ title, icon, items }: { title: string, icon: React.ReactNode, items: { label: string, value: string, hasFlag?: boolean }[] }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        {icon}
        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">{title}</h3>
      </div>
      <div className="px-4 py-3 space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex flex-wrap items-center">
            <span className="w-28 text-[11px] font-bold text-slate-500 dark:text-slate-400">{item.label}</span>
            <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 ml-2 flex items-center gap-1.5">
              : 
              {item.hasFlag && <span className="inline-block w-4 h-3 bg-green-700 border border-white rounded-[2px] ml-1 shadow-sm flex items-center justify-center text-[6px] text-white overflow-hidden">
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
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-bold text-foreground outline-none transition focus:border-primary">
        <option value="">All</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="relative">
        <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs font-bold text-foreground outline-none transition-all focus:border-primary" />
        <CalendarDays className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
      </div>
    </label>
  );
}


