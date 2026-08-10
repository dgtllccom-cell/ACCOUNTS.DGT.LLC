"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Printer, Search } from "lucide-react";
import { DownloadActionIcon } from "@/components/ui/download-action-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";
import { ReportPageHeader } from "@/components/reports/report-page-header";
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
  ledger_id: string | null;
  ledgers?: { name: string; code: string } | null;
};

type ReportRow = {
  id: string;
  type: string;
  entry_category: RoznamchaEntryCategory | null;
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
  scopes: {
    countryIds: string[];
    countryBranchIds: string[];
    cityBranchIds: string[];
    isSuperAdmin: boolean;
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

function fmtNumber(value: number) {
  const n = Number.isFinite(value) ? value : 0;
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

const DEBIT_LEAN_TYPES = new Set(["cash_receipt", "bank_deposit", "debit"]);

function isDebitRow(row: ReportRow) {
  const line = primaryLine(row);
  return line ? DEBIT_LEAN_TYPES.has(String(line.payment_entry_type ?? "")) : false;
}

function printReportTable(opts: { title: string; subtitle: string; rows: ReportRow[]; totals: { debit: number; credit: number } }) {
  if (typeof window === "undefined") return;
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return;

  const bodyRows = opts.rows
    .map((row, idx) => {
      const line = primaryLine(row);
      return `<tr>
        <td>${idx + 1}</td>
        <td>${row.entry_date}${row.posted_at ? " " + new Date(row.posted_at).toLocaleTimeString() : ""}</td>
        <td>${row.entry_category ? CATEGORY_LABELS[row.entry_category] : "-"}</td>
        <td>${line?.ledgers?.name ?? "-"}</td>
        <td>${(row.narration ?? "-").slice(0, 80)}</td>
        <td class="num">${line?.debit ? fmtNumber(Number(line.debit)) : ""}</td>
        <td class="num">${line?.credit ? fmtNumber(Number(line.credit)) : ""}</td>
        <td>${line?.currency ?? "-"}</td>
        <td>${branchName(row)}</td>
        <td>${billNumber(row)}</td>
        <td>${row.status}</td>
      </tr>`;
    })
    .join("");

  win.document.write(`<!doctype html><html><head><title>${opts.title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 18px; margin-bottom: 2px; }
      p.sub { color: #555; margin-top: 0; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
      th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
      th { background: #111; color: #fff; }
      td.num { text-align: right; }
      tfoot td { font-weight: bold; background: #f3f3f3; }
    </style>
  </head><body>
    <h1>${opts.title}</h1>
    <p class="sub">${opts.subtitle}</p>
    <table>
      <thead><tr>
        <Th>#</Th><Th>Date</Th><Th>Type</Th><Th>Account</Th><Th>Narration</Th>
        <Th>Debit</Th><Th>Credit</Th><Th>Currency</Th><Th>Branch</Th><Th>Bill/Ref No</Th><Th>Status</Th>
      </tr></thead>
      <tbody>${bodyRows}</tbody>
      <tfoot><tr>
        <td colspan="5">Totals</td>
        <td class="num">${fmtNumber(opts.totals.debit)}</td>
        <td class="num">${fmtNumber(opts.totals.credit)}</td>
        <td colspan="4"></td>
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
  const activeLang = useActiveLanguage();
  const currentLang = activeLang || lang;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

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
      if (!info.scopes.isSuperAdmin) {
        if (info.scopes.countryIds[0]) params.set("countryId", info.scopes.countryIds[0]);
        if (info.scopes.cityBranchIds[0]) params.set("cityBranchId", info.scopes.cityBranchIds[0]);
        else if (info.scopes.countryBranchIds[0]) params.set("countryBranchId", info.scopes.countryBranchIds[0]);
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
      "S.No", "Date", "Entry Type", "Account", "Narration", "Debit", "Credit",
      "Currency", "Country", "Branch", "User", "Bill/Reference No", "Posting Status"
    ];
    const csvRows = rows.map((row, idx) => {
      const line = primaryLine(row);
      return [
        String(idx + 1 + (page - 1) * pageSize),
        row.entry_date,
        row.entry_category ? CATEGORY_LABELS[row.entry_category] : "-",
        line?.ledgers?.name ?? "-",
        row.narration ?? "",
        line?.debit ? String(line.debit) : "",
        line?.credit ? String(line.credit) : "",
        line?.currency ?? "",
        row.countries?.name ?? "-",
        branchName(row),
        row.profiles?.full_name ?? "-",
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
      totals: { debit: data?.totalDebit ?? 0, credit: data?.totalCredit ?? 0 }
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
    <div className="space-y-4">
      <ReportPageHeader
        title={pageTitle}
        subtitle={`Roznamcha report · ${entryCategory === "all" ? "All entry types" : CATEGORY_LABELS[entryCategory]}`}
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setFiltersOpen((v) => !v)}>
              <Search className="h-4 w-4" aria-hidden />
              <span className="ms-2">{filtersOpen ? "Hide Filters" : "Search / Filters"}</span>
            </Button>
            <Button type="button" variant="outline" onClick={printReport} disabled={!rows.length}>
              <Printer className="h-4 w-4" aria-hidden />
              <span className="ms-2">Print / PDF</span>
            </Button>
            <Button type="button" variant="outline" onClick={exportCsv} disabled={!rows.length}>
              <DownloadActionIcon className="h-4 w-4" aria-hidden />
              <span className="ms-2">Excel Export</span>
            </Button>
          </>
        }
      />

      {filtersOpen ? (
        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">From Date</Label>
                <Input className="h-9 text-xs" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">To Date</Label>
                <Input className="h-9 text-xs" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              {entryCategory === "all" ? (
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Entry Type</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as RoznamchaEntryCategory | "all")}
                  >
                    <option value="all">All Types</option>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Debit / Credit</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                  value={debitCredit}
                  onChange={(e) => setDebitCredit(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
              <SearchSelect
                label="Currency"
                value={currency}
                placeholder="All"
                options={[{ value: "all", label: "All" }, ...currencyOptions]}
                onValueChange={setCurrency}
              />
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Status</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="draft">Draft</option>
                  <option value="posted">Posted</option>
                  <option value="transferred">Transferred</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Reference No</Label>
                <Input className="h-9 text-xs" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="Reference number" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Bill No</Label>
                <Input className="h-9 text-xs" value={billNo} onChange={(e) => setBillNo(e.target.value)} placeholder="Bill number" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-[11px] text-muted-foreground">Search</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-9 pl-9 text-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Voucher, narration, reference..." />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={applySearch} disabled={loading}>Apply</Button>
              <Button type="button" size="sm" variant="secondary" onClick={resetFilters} disabled={loading}>Reset</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Entries" value={String(data?.totalCount ?? 0)} tone="text-slate-950 dark:text-slate-100" />
        <StatCard label="Total Debit" value={fmtNumber(data?.totalDebit ?? 0)} tone="text-rose-600" />
        <StatCard label="Total Credit" value={fmtNumber(data?.totalCredit ?? 0)} tone="text-emerald-600" />
        <StatCard label="Net Balance" value={fmtNumber(data?.netBalance ?? 0)} tone="text-slate-950 dark:text-slate-100" />
        <StatCard label="Posted" value={String(data?.postedCount ?? 0)} tone="text-emerald-600" />
        <StatCard label="Pending / Other" value={String(data?.pendingCount ?? 0)} tone="text-amber-600" />
      </div>

      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Entries</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[1200px] border-collapse text-xs">
              <thead className="bg-slate-900 text-white">
                <tr>
                  <ReportTh>S.No</ReportTh>
                  <SortableTh label="Date / Time" column="entry_date" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                  <ReportTh>Entry Type</ReportTh>
                  <ReportTh>Account</ReportTh>
                  <ReportTh className="text-start">Narration</ReportTh>
                  <ReportTh>Debit</ReportTh>
                  <ReportTh>Credit</ReportTh>
                  <ReportTh>Balance</ReportTh>
                  <ReportTh>Currency</ReportTh>
                  <ReportTh>Country</ReportTh>
                  <ReportTh>Branch</ReportTh>
                  <ReportTh>User</ReportTh>
                  <ReportTh>Bill/Ref No</ReportTh>
                  <ReportTh>Status</ReportTh>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={14} className="p-4 text-center text-sm text-muted-foreground">Loading...</td></tr>
                ) : rows.length ? (
                  rows.map((row, idx) => {
                    const line = primaryLine(row);
                    const debit = Number(line?.debit || 0);
                    const credit = Number(line?.credit || 0);
                    return (
                      <tr key={row.id} className={cn("border-t hover:bg-muted/40", idx % 2 ? "bg-muted/10" : "bg-background")}>
                        <ReportTd className="text-center">{idx + 1 + (page - 1) * pageSize}</ReportTd>
                        <ReportTd className="text-center whitespace-nowrap">
                          {row.entry_date}
                          {row.posted_at ? <div className="text-[10px] text-muted-foreground">{new Date(row.posted_at).toLocaleTimeString()}</div> : null}
                        </ReportTd>
                        <ReportTd className="text-center whitespace-nowrap">{getCategoryLabel(row.entry_category, currentLang)}</ReportTd>
                        <ReportTd className="whitespace-nowrap">{line?.ledgers?.name ?? "-"}</ReportTd>
                        <ReportTd className="max-w-[260px] text-start"><div className="truncate">{row.narration ?? "-"}</div></ReportTd>
                        <ReportTd className="text-end font-mono text-rose-600">{debit ? fmtNumber(debit) : "-"}</ReportTd>
                        <ReportTd className="text-end font-mono text-emerald-600">{credit ? fmtNumber(credit) : "-"}</ReportTd>
                        <ReportTd className="text-end font-mono">{fmtNumber(debit - credit)}</ReportTd>
                        <ReportTd className="text-center">{line?.currency ?? "-"}</ReportTd>
                        <ReportTd className="whitespace-nowrap">{row.countries?.name ?? "-"}</ReportTd>
                        <ReportTd className="whitespace-nowrap">{branchName(row)}</ReportTd>
                        <ReportTd className="whitespace-nowrap">{row.profiles?.full_name ?? "-"}</ReportTd>
                        <ReportTd className="whitespace-nowrap font-mono">{billNumber(row)}</ReportTd>
                        <ReportTd className="text-center capitalize">{row.status}</ReportTd>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={14} className="p-4 text-center text-sm text-muted-foreground">{t(currentLang, "common.no_entries_found", "No entries found")}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <ReportPagination
        totalCount={data?.totalCount ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}

function SortableTh({
  label,
  column,
  sortBy,
  sortDir,
  onSort
}: {
  label: string;
  column: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (column: string) => void;
}) {
  const active = sortBy === column;
  return (
    <ReportTh className="cursor-pointer select-none" >
      <button type="button" onClick={() => onSort(column)} className="inline-flex items-center gap-1">
        {label}
        {active ? <span>{sortDir === "asc" ? "▲" : "▼"}</span> : null}
      </button>
    </ReportTh>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="border-slate-200/80 shadow-sm">
      <CardContent className="p-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-xl font-semibold leading-none tracking-tight", tone)}>{value}</div>
      </CardContent>
    </Card>
  );
}
