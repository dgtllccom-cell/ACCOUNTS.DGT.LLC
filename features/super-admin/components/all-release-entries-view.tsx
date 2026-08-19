"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { apiGet } from "@/lib/api/client";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { t } from "@/lib/i18n/ui";
import { openJournalReportWindow } from "@/lib/reports/open-journal-report-window";

type FeedEntry = {
  sr: number;
  recordId?: string;
  sourceModule?: string;
  module: string;
  txnType?: string;
  entryNo?: string;
  reference: string;
  date: string;
  country: string;
  branch: string;
  entryName: string;
  party: string;
  currency: string;
  debit: number;
  credit: number;
  status: string;
  createdBy?: string;
  approvedBy?: string;
  href: string;
};

type Summary = {
  countries: number;
  branches: number;
  todayEntries: number;
  totalDebit: number;
  totalCredit: number;
  netMovement: number;
};

type ActivityResponse = {
  summary: Summary | null;
  entries: FeedEntry[];
  total: number;
  page: number;
  pageSize: number;
  connected: boolean;
  filters?: { countries: { id: string; name: string }[]; currencies: string[] };
  connectedModules?: string[];
};

const MODULES = ["all", "Journal", "Payment", "Bank", "Purchase", "Sale", "Transfer", "Customer", "Company", "Warehouse", "Supplier", "Expense"];

function fmtMoney(n: number) {
  return Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function compact(n: number) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(Math.round(n));
}

export function AllReleaseEntriesView({ lang: langProp = "en" }: { lang?: string }) {
  const router = useRouter();
  const activeLang = useActiveLanguage();
  const lang = (activeLang || langProp) as any;
  const isRtl = ["ur", "ar", "fa", "ps"].includes(lang);
  const tt = useCallback((key: string, fallback: string) => t(lang, key as never, fallback), [lang]);

  const [data, setData] = useState<ActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState("all");
  const [countryId, setCountryId] = useState("");
  const [currency, setCurrency] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [searchQ, setSearchQ] = useState(""); // debounced value actually sent to the server
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<FeedEntry | null>(null);
  const pageSize = 25;

  // Debounce the free-text search (server-side) so paging stays fast at scale.
  useEffect(() => {
    const h = setTimeout(() => { setSearchQ(search); setPage(1); }, 350);
    return () => clearTimeout(h);
  }, [search]);
  // Reset to page 1 whenever a filter changes.
  useEffect(() => { setPage(1); }, [moduleFilter, countryId, currency, status, dateFrom, dateTo]);

  // Build the server query string from the current filter state.
  const buildQuery = useCallback((over: Record<string, string> = {}) => {
    const qp = new URLSearchParams({ module: moduleFilter, page: String(page), pageSize: String(pageSize) });
    if (countryId) qp.set("countryId", countryId);
    if (currency) qp.set("currency", currency);
    if (status) qp.set("status", status);
    if (dateFrom) qp.set("dateFrom", dateFrom);
    if (dateTo) qp.set("dateTo", dateTo);
    if (searchQ.trim()) qp.set("search", searchQ.trim());
    Object.entries(over).forEach(([k, v]) => qp.set(k, v));
    return qp;
  }, [moduleFilter, countryId, currency, status, dateFrom, dateTo, searchQ, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<ActivityResponse>(`/api/erp/super-admin/activity?${buildQuery().toString()}`);
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Failed to load ERP activity");
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => { void load(); }, [load]);

  const summary = data?.summary;
  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function clearFilters() {
    setModuleFilter("all"); setCountryId(""); setCurrency(""); setStatus(""); setDateFrom(""); setDateTo(""); setSearch(""); setSearchQ(""); setPage(1);
  }

  // CSV export of the current filtered result set (server-side filtered; capped so the browser
  // never pulls the entire ERP history). Fetches up to EXPORT_CAP matching rows in one request.
  const EXPORT_CAP = 5000;
  async function exportCsv() {
    setExporting(true);
    try {
      const res = await apiGet<ActivityResponse>(`/api/erp/super-admin/activity?${buildQuery({ page: "1", pageSize: String(EXPORT_CAP) }).toString()}`);
      const cols: Array<[string, (e: FeedEntry) => string]> = [
        [tt("rozrep.sno", "Sr #"), (e) => String(e.sr)],
        [tt("bankroz.date_time", "Date / Time"), (e) => (e.date ? new Date(e.date).toLocaleString() : "")],
        [tt("sae.module", "Module"), (e) => moduleLabel(e.module)],
        [tt("sae.txn_type", "Transaction Type"), (e) => e.txnType || ""],
        [tt("bankroz.entry_no", "Entry No"), (e) => e.entryNo || ""],
        [tt("rozrep.country", "Country"), (e) => e.country],
        [tt("rozrep.branch", "Branch"), (e) => e.branch],
        [tt("sae.entry_name", "Entry Name"), (e) => e.entryName],
        [tt("sae.party", "Party / Person"), (e) => e.party],
        [tt("acct.reference_no", "Reference"), (e) => e.reference],
        [tt("rozrep.currency", "Currency"), (e) => e.currency],
        [tt("rozrep.debit", "Debit"), (e) => (e.debit ? String(e.debit) : "")],
        [tt("rozrep.credit", "Credit"), (e) => (e.credit ? String(e.credit) : "")],
        [tt("acct.created_by", "Created By"), (e) => e.createdBy || ""],
        [tt("vch.approved_by", "Approved By"), (e) => e.approvedBy || ""],
        [tt("acct.status", "Status"), (e) => e.status]
      ];
      const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const lines = [cols.map(([h]) => esc(h)).join(",")];
      (res.entries || []).forEach((e) => lines.push(cols.map(([, f]) => esc(f(e))).join(",")));
      const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `all-release-entries-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  function printJournal() {
    openJournalReportWindow({
      lang,
      autoPrint: true,
      title: tt("sae.title", "Super Admin — All Release Entries"),
      subtitle: tt("sae.latest_entries", "Latest ERP Entries"),
      overviewLabel: tt("jrn.overview", "Activity Overview"),
      scopeName: tt("sae.title", "All Release Entries"),
      reportIdPrefix: "ERPFEED",
      reportIdValue: moduleFilter,
      chips: [
        { label: tt("sae.module", "Module"), value: moduleFilter === "all" ? tt("sae.all_modules", "All ERP Modules") : moduleFilter },
        { label: tt("jrn.date_range", "Date Range"), value: dateFrom || dateTo ? `${dateFrom || "…"} → ${dateTo || "…"}` : undefined },
        { label: tt("acct.status", "Status"), value: status || undefined }
      ],
      kpis: summary ? [
        { label: tt("sae.total_countries", "Countries"), value: String(summary.countries), tone: "open" },
        { label: tt("bankroz.total_debit", "Total Debit"), value: fmtMoney(summary.totalDebit), tone: "debit" },
        { label: tt("bankroz.total_credit", "Total Credit"), value: fmtMoney(summary.totalCredit), tone: "credit" },
        { label: tt("sae.today_entries", "Today"), value: String(summary.todayEntries), tone: "current" }
      ] : [],
      columns: [
        { key: "sr", label: tt("rozrep.sno", "Sr #") },
        { key: "date", label: tt("bankroz.date_time", "Date / Time") },
        { key: "module", label: tt("sae.module", "Module") },
        { key: "country", label: tt("rozrep.country", "Country") },
        { key: "branch", label: tt("rozrep.branch", "Branch") },
        { key: "entryName", label: tt("sae.entry_name", "Entry Name") },
        { key: "party", label: tt("sae.party", "Party") },
        { key: "reference", label: tt("acct.reference_no", "Reference") },
        { key: "debit", label: tt("rozrep.debit", "Debit"), num: true },
        { key: "credit", label: tt("rozrep.credit", "Credit"), num: true },
        { key: "status", label: tt("acct.status", "Status") }
      ],
      rows: entries.map((e) => ({
        sr: String(e.sr), date: e.date ? new Date(e.date).toLocaleString() : "-", module: moduleLabel(e.module),
        country: e.country, branch: e.branch, entryName: e.entryName, party: e.party, reference: e.reference,
        debit: e.debit ? fmtMoney(e.debit) : "-", credit: e.credit ? fmtMoney(e.credit) : "-", status: e.status
      }))
    });
  }

  const moduleLabel = (m: string) => {
    const map: Record<string, string> = {
      all: tt("sae.all_modules", "All ERP Modules"),
      Journal: tt("nav.business_report", "Journal"),
      Payment: tt("sae.payment", "Payment / Receipt"),
      Bank: tt("bankroz.bank", "Bank"),
      Purchase: tt("nav.purchase_entry", "Purchase"),
      Sale: tt("sae.sale", "Sale"),
      Transfer: tt("roz.transfer_report", "Transfer"),
      Customer: tt("acct.customer_name", "Customer"),
      Company: tt("acct.company_name", "Company"),
      Warehouse: tt("sae.warehouse", "Warehouse"),
      Supplier: tt("prof.supplier_report", "Supplier"),
      Expense: tt("sae.expense", "Expense")
    };
    return map[m] || m;
  };

  function printSelected() {
    if (!selected) return;
    openJournalReportWindow({
      lang,
      autoPrint: true,
      title: tt("sae.entry_report", "ERP Entry Report"),
      subtitle: selected.entryName,
      overviewLabel: tt("jrn.overview", "Entry Overview"),
      scopeName: selected.entryName,
      reportIdPrefix: "ERP",
      reportIdValue: selected.reference || selected.recordId || "entry",
      chips: [
        { label: tt("sae.module", "Module"), value: moduleLabel(selected.module) },
        { label: tt("rozrep.country", "Country"), value: selected.country },
        { label: tt("rozrep.branch", "Branch"), value: selected.branch },
        { label: tt("acct.reference_no", "Reference"), value: selected.reference }
      ],
      kpis: [
        { label: tt("rozrep.debit", "Debit"), value: fmtMoney(selected.debit), tone: "debit" },
        { label: tt("rozrep.credit", "Credit"), value: fmtMoney(selected.credit), tone: "credit" },
        { label: tt("rozrep.currency", "Currency"), value: selected.currency || "-", tone: "current" },
        { label: tt("acct.status", "Status"), value: selected.status, tone: "open" }
      ],
      columns: [
        { key: "field", label: tt("sae.field", "Field") },
        { key: "value", label: tt("sae.value", "Value") }
      ],
      rows: [
        { field: tt("sae.entry_name", "Entry Name"), value: selected.entryName },
        { field: tt("sae.module", "Module"), value: moduleLabel(selected.module) },
        { field: tt("rozrep.country", "Country"), value: selected.country },
        { field: tt("rozrep.branch", "Branch"), value: selected.branch },
        { field: tt("sae.party", "Party / Person"), value: selected.party },
        { field: tt("bankroz.entry_no", "Entry No"), value: selected.entryNo },
        { field: tt("sae.txn_type", "Transaction Type"), value: selected.txnType },
        { field: tt("acct.reference_no", "Reference"), value: selected.reference },
        { field: tt("rozrep.currency", "Currency"), value: selected.currency },
        { field: tt("rozrep.debit", "Debit"), value: fmtMoney(selected.debit) },
        { field: tt("rozrep.credit", "Credit"), value: fmtMoney(selected.credit) },
        { field: tt("acct.created_by", "Created By"), value: selected.createdBy },
        { field: tt("vch.approved_by", "Approved By"), value: selected.approvedBy },
        { field: tt("acct.status", "Status"), value: selected.status }
      ]
    });
  }

  const statusClass = (s: string) => {
    const v = String(s || "").toLowerCase();
    if (v.includes("post") || v.includes("final") || v.includes("complete") || v.includes("active") || v.includes("transferred")) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    if (v.includes("pend") || v.includes("partial") || v.includes("draft")) return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
  };

  const cards: Array<{ k: string; v: string; s: string }> = summary ? [
    { k: tt("sae.total_countries", "Total Countries"), v: String(summary.countries), s: tt("sae.all_countries", "All operating countries") },
    { k: tt("sae.total_branches", "Total Branches"), v: String(summary.branches), s: tt("sae.all_offices", "All offices") },
    { k: tt("sae.today_entries", "Today's ERP Entries"), v: String(summary.todayEntries), s: tt("sae.all_modules_combined", "All modules combined") },
    { k: tt("bankroz.total_debit", "Total Debit"), v: compact(summary.totalDebit), s: tt("sae.selected_view", "Selected view") },
    { k: tt("bankroz.total_credit", "Total Credit"), v: compact(summary.totalCredit), s: tt("sae.selected_view", "Selected view") },
    { k: tt("sae.net_movement", "Net Movement"), v: (summary.netMovement >= 0 ? "+" : "") + compact(summary.netMovement), s: tt("sae.debit_minus_credit", "Debit minus credit") }
  ] : [];

  return (
    <div className="space-y-4 text-slate-900 dark:text-slate-100" dir={isRtl ? "rtl" : "ltr"}>
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black">{tt("sae.title", "Super Admin — All Release Entries")}</h1>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">{tt("sae.subtitle", "One live control center for all ERP modules, all countries, all branches — latest activity, debit/credit movement and full entry drill-down.")}</p>
        </div>
        <button onClick={() => void load()} className="rounded-lg bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25">↻ {tt("sae.refresh", "Refresh")}</button>
      </div>

      {/* Summary cards (real data) */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        {loading && !summary ? (
          Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-20 rounded-xl border border-slate-200 bg-slate-50 animate-pulse dark:border-slate-800 dark:bg-slate-900" />)
        ) : cards.map((c, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="text-[10px] font-bold uppercase text-slate-500">{c.k}</div>
            <div className="mt-1 text-xl font-black">{c.v}</div>
            <div className="text-[10px] text-slate-400">{c.s}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">{tt("sae.module", "Module")}</label>
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="h-9 rounded-md border border-slate-300 bg-background px-2 text-xs font-semibold dark:border-slate-700">
            {MODULES.map((m) => <option key={m} value={m}>{moduleLabel(m)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">{tt("sae.country", "Country")}</label>
          <select value={countryId} onChange={(e) => setCountryId(e.target.value)} className="h-9 rounded-md border border-slate-300 bg-background px-2 text-xs font-semibold dark:border-slate-700">
            <option value="">{tt("sae.all_countries", "All Countries")}</option>
            {(data?.filters?.countries ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">{tt("sae.currency", "Currency")}</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="h-9 rounded-md border border-slate-300 bg-background px-2 text-xs font-semibold dark:border-slate-700">
            <option value="">{tt("sae.all_currencies", "All Currencies")}</option>
            {(data?.filters?.currencies ?? []).map((cur) => <option key={cur} value={cur}>{cur}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">{tt("acct.status", "Status")}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 rounded-md border border-slate-300 bg-background px-2 text-xs font-semibold dark:border-slate-700">
            <option value="">{tt("rozrep.all", "All")}</option>
            <option value="posted">{tt("bankroz.cleared", "Posted")}</option>
            <option value="pending">{tt("bankroz.pending", "Pending")}</option>
            <option value="active">{tt("acct.registered", "Active")}</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">{tt("bankroz.from_date", "From Date")}</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 rounded-md border border-slate-300 bg-background px-2 text-xs dark:border-slate-700" />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">{tt("bankroz.to_date", "To Date")}</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-md border border-slate-300 bg-background px-2 text-xs dark:border-slate-700" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-bold text-slate-500 mb-1">{tt("sae.search_all", "Search All Entries")}</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tt("sae.search_ph", "Search customer, employee, bank, purchase, sale, voucher, branch, reference...")} className="h-9 w-full rounded-md border border-slate-300 bg-background px-3 text-xs dark:border-slate-700" />
        </div>
        <button onClick={clearFilters} className="h-9 rounded-md border border-slate-300 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">{tt("bankroz.reset_filters", "Clear Filters")}</button>
        <button onClick={exportCsv} disabled={exporting} className="h-9 rounded-md border border-emerald-500 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30">⬇ {tt("sae.export_csv", "Export CSV")}</button>
        <button onClick={printJournal} className="h-9 rounded-md bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-700">{tt("bankroz.print_pdf", "Print / PDF")}</button>
      </div>

      {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}

      {/* Feed table (real data) */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-black">{tt("sae.latest_entries", "Latest ERP Entries — All Countries & Branches")}</h2>
          <span className="text-[11px] text-slate-500">{tt("sae.click_row", "Click any row to open full detail")} · {tt("sae.total_records", "Total")}: {total.toLocaleString()}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/50">
              <tr className="text-[10px] uppercase text-slate-500">
                <th className="p-2 text-start">{tt("rozrep.sno", "Sr #")}</th>
                <th className="p-2 text-start">{tt("bankroz.date_time", "Date / Time")}</th>
                <th className="p-2 text-start">{tt("sae.module", "Module")}</th>
                <th className="p-2 text-start">{tt("rozrep.country", "Country")}</th>
                <th className="p-2 text-start">{tt("rozrep.branch", "Branch")}</th>
                <th className="p-2 text-start">{tt("sae.entry_name", "Entry Name")}</th>
                <th className="p-2 text-start">{tt("sae.party", "Party / Person")}</th>
                <th className="p-2 text-start">{tt("acct.reference_no", "Reference")}</th>
                <th className="p-2 text-start">{tt("rozrep.currency", "Currency")}</th>
                <th className="p-2 text-end">{tt("rozrep.debit", "Debit")}</th>
                <th className="p-2 text-end">{tt("rozrep.credit", "Credit")}</th>
                <th className="p-2 text-start">{tt("acct.status", "Status")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="p-6 text-center text-slate-400">{tt("sae.loading", "Loading ERP activity...")}</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={12} className="p-6 text-center text-slate-400">{tt("report.builder_no_records", "No records found")}</td></tr>
              ) : entries.map((e) => (
                <tr key={e.sr} onClick={() => setSelected(e)} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50">
                  <td className="p-2 font-mono text-slate-500">{e.sr}</td>
                  <td className="p-2 whitespace-nowrap">{e.date ? new Date(e.date).toLocaleString() : "-"}</td>
                  <td className="p-2 font-semibold">{moduleLabel(e.module)}</td>
                  <td className="p-2">{e.country || "-"}</td>
                  <td className="p-2">{e.branch || "-"}</td>
                  <td className="p-2 max-w-[220px] truncate">{e.entryName}</td>
                  <td className="p-2">{e.party || "-"}</td>
                  <td className="p-2 font-mono">{e.reference || "-"}</td>
                  <td className="p-2">{e.currency || "-"}</td>
                  <td className="p-2 text-end font-mono text-rose-600">{e.debit ? fmtMoney(e.debit) : "-"}</td>
                  <td className="p-2 text-end font-mono text-emerald-600">{e.credit ? fmtMoney(e.credit) : "-"}</td>
                  <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass(e.status)}`}>{e.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Server-side pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-2 text-xs dark:border-slate-800">
          <span className="text-slate-500">{tt("sae.page", "Page")} {page} / {totalPages} · {total.toLocaleString()} {tt("sae.records", "records")}</span>
          <div className="flex items-center gap-1">
            <button disabled={page <= 1} onClick={() => setPage(1)} className="rounded border border-slate-300 px-2 py-1 font-bold disabled:opacity-40 dark:border-slate-700">«</button>
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border border-slate-300 px-2 py-1 font-bold disabled:opacity-40 dark:border-slate-700">‹</button>
            <span className="px-2 font-bold">{page}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded border border-slate-300 px-2 py-1 font-bold disabled:opacity-40 dark:border-slate-700">›</button>
            <button disabled={page >= totalPages} onClick={() => setPage(totalPages)} className="rounded border border-slate-300 px-2 py-1 font-bold disabled:opacity-40 dark:border-slate-700">»</button>
          </div>
        </div>
      </div>

      {/* Drill-down drawer */}
      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSelected(null)} />
          <aside className={`fixed top-0 z-50 h-full w-full max-w-md overflow-auto bg-white p-5 shadow-2xl dark:bg-slate-900 ${isRtl ? "left-0" : "right-0"}`} dir={isRtl ? "rtl" : "ltr"}>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <h2 className="text-base font-black">{selected.entryName}</h2>
              <button onClick={() => setSelected(null)} className="rounded-md bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800">✕</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {([
                [tt("sae.module", "Module"), moduleLabel(selected.module)],
                [tt("rozrep.country", "Country"), selected.country],
                [tt("rozrep.branch", "Branch"), selected.branch],
                [tt("sae.party", "Party / Person"), selected.party],
                [tt("bankroz.entry_no", "Entry No"), selected.entryNo || ""],
                [tt("sae.txn_type", "Transaction Type"), selected.txnType || ""],
                [tt("acct.reference_no", "Reference"), selected.reference],
                [tt("rozrep.currency", "Currency"), selected.currency],
                [tt("rozrep.debit", "Debit"), fmtMoney(selected.debit)],
                [tt("rozrep.credit", "Credit"), fmtMoney(selected.credit)],
                [tt("acct.created_by", "Created By"), selected.createdBy || ""],
                [tt("vch.approved_by", "Approved By"), selected.approvedBy || ""],
                [tt("acct.status", "Status"), selected.status]
              ] as [string, string][]).map(([k, v], i) => (
                <div key={i} className="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500">{k}</div>
                  <div className="text-xs font-bold break-words">{v || "-"}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => selected.href && router.push(selected.href as Route)} className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700">{tt("sae.open_module", "Open Full Module")}</button>
              <button onClick={printSelected} className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">{tt("bankroz.print_pdf", "Print / PDF")}</button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
