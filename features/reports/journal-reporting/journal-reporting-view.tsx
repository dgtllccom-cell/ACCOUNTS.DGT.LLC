"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet, apiPost, apiPatch, apiFetch } from "@/lib/api/client";
import { openUniversalPrintReport, buildUniversalPrintHtml, type UniversalPrintInput } from "@/lib/reports/universal-print-engine";
import type { ReportContext } from "@/lib/reports/resolve-report-context";
import type { ReportMetaOption } from "@/features/reports/components/universal-report-shell";
import {
  defaultJournalFilters,
  computeDatePreset,
  defaultJournalReportConfig,
  normalizeJournalReportConfig,
  type JournalFilters,
  type JournalReportConfig,
  type JournalColumnKey
} from "./default-config";
import { JournalReportingCharts, type JournalChartsData } from "./journal-reporting-charts";
import { JournalReportingCustomize, columnLabel } from "./journal-reporting-customize";

// Mirrors lib/services/journal-report-service.ts's JournalRegisterRow — NOT imported directly
// because that module pulls in withLocalPg/ErpSession (server-only) which must never reach the
// client bundle. Keep this shape in sync with the API route's JSON response.
type JournalRegisterRow = {
  id: string;
  entryId: string;
  sourceTable: "roznamcha" | "ledger_posting";
  date: string;
  journalNo: string | null;
  voucherNo: string | null;
  referenceNo: string | null;
  description: string | null;
  accountId: string | null;
  accountCode: string | null;
  accountName: string | null;
  customerName: string | null;
  companyName: string | null;
  debit: number;
  credit: number;
  currency: string;
  usdRate: number;
  countryName: string | null;
  countryBranchName: string | null;
  cityBranchName: string | null;
  createdByName: string | null;
  approvedByName: string | null;
  approvalStatus: "approved" | "pending";
  status: string;
};

type JournalApiResponse = {
  reportScope: string;
  generatedAt: string;
  kpis: {
    openingBalance: number;
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
    totalJournalEntries: number;
    approvedEntries: number;
    pendingEntries: number;
  };
  charts: JournalChartsData;
  table: { rows: JournalRegisterRow[]; totalCount: number; page: number; pageSize: number };
  totals: { debit: number; credit: number; balance: number };
};

type MetaResponse = {
  countries: ReportMetaOption[];
  countryBranches: ReportMetaOption[];
  cityBranches: ReportMetaOption[];
  accounts: ReportMetaOption[];
  companies: ReportMetaOption[];
  customers: ReportMetaOption[];
  journalTypes: string[];
  voucherTypes: string[];
  currencies: string[];
  users: ReportMetaOption[];
  statuses: string[];
  approvalStatuses: string[];
};

type SavedView = {
  id: string;
  name: string;
  isPublic: boolean;
  config: { filters?: JournalFilters; reportConfig?: JournalReportConfig };
};

const PAGE_SIZE = 50;
const DATE_PRESETS: Array<[string, string, string]> = [
  ["today", "preset_today", "Today"],
  ["yesterday", "preset_yesterday", "Yesterday"],
  ["this_week", "preset_this_week", "This Week"],
  ["this_month", "preset_this_month", "This Month"],
  ["this_quarter", "preset_this_quarter", "This Quarter"],
  ["this_year", "preset_this_year", "This Year"],
  ["prev_month", "preset_prev_month", "Previous Month"],
  ["prev_year", "preset_prev_year", "Previous Year"]
];

function numberFmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function JournalReportingView({ context, langProp }: { context: ReportContext; langProp?: string | null }) {
  const s = useErpScreen("jrpt", langProp);
  const router = useRouter();

  const [filters, setFilters] = useState<JournalFilters>(defaultJournalFilters);
  const [appliedFilters, setAppliedFilters] = useState<JournalFilters>(defaultJournalFilters);
  const [config, setConfig] = useState<JournalReportConfig>(defaultJournalReportConfig);
  const [data, setData] = useState<JournalApiResponse | null>(null);
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showSaveView, setShowSaveView] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showSavedList, setShowSavedList] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [saveViewName, setSaveViewName] = useState("");
  const [saveViewPublic, setSaveViewPublic] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    apiGet<MetaResponse>("/api/erp/reports/journal/meta")
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  const loadSavedViews = useCallback(() => {
    // /api/erp/reports/saved returns { success, data } (not the { ok, data }
    // envelope apiFetch/apiGet unwrap) — same shape components/reports/builder/
    // saved-reports-manager.tsx already reads directly for this same endpoint.
    fetch("/api/erp/reports/saved?module=journal_reporting", { credentials: "include", cache: "no-store" })
      .then((res) => res.json())
      .then((json) => setSavedViews(Array.isArray(json?.data) ? json.data : []))
      .catch(() => setSavedViews([]));
  }, []);
  useEffect(() => {
    loadSavedViews();
  }, [loadSavedViews]);

  const buildQuery = useCallback((f: JournalFilters, pageArg: number, pageSize: number) => {
    const params = new URLSearchParams();
    params.set("fromDate", f.fromDate);
    params.set("toDate", f.toDate);
    params.set("page", String(pageArg));
    params.set("pageSize", String(pageSize));
    const map: Array<[keyof JournalFilters, string]> = [
      ["countryId", "countryId"],
      ["countryBranchId", "countryBranchId"],
      ["cityBranchId", "cityBranchId"],
      ["companyId", "companyId"],
      ["ledgerId", "ledgerId"],
      ["customerId", "customerId"],
      ["journalType", "journalType"],
      ["voucherType", "voucherType"],
      ["currency", "currency"],
      ["createdBy", "createdBy"],
      ["approvedBy", "approvedBy"],
      ["approvalStatus", "approvalStatus"],
      ["status", "status"],
      ["drCr", "drCr"],
      ["referenceNo", "referenceNo"]
    ];
    for (const [k, qp] of map) {
      const v = f[k];
      if (v) params.set(qp, v);
    }
    return params.toString();
  }, []);

  const load = useCallback(
    async (f: JournalFilters, pageArg: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<JournalApiResponse>(`/api/erp/reports/journal?${buildQuery(f, pageArg, PAGE_SIZE)}`);
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : s.t("error_loading", "Failed to load journal report data."));
      } finally {
        setLoading(false);
      }
    },
    [buildQuery, s]
  );

  useEffect(() => {
    load(appliedFilters, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters, page]);

  function applyFilters() {
    setPage(1);
    setAppliedFilters(filters);
  }
  function resetFilters() {
    const d = defaultJournalFilters();
    setFilters(d);
    setAppliedFilters(d);
    setPage(1);
  }
  function applyPreset(preset: string) {
    const { fromDate, toDate } = computeDatePreset(preset);
    const next = { ...filters, datePreset: preset, fromDate, toDate };
    setFilters(next);
    setAppliedFilters(next);
    setPage(1);
  }
  function setFilter<K extends keyof JournalFilters>(key: K, value: JournalFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  const fetchAllRows = useCallback(async (): Promise<JournalRegisterRow[]> => {
    const totalCount = data?.table.totalCount ?? 0;
    const size = Math.max(1, Math.min(totalCount || PAGE_SIZE, 5000));
    const res = await apiGet<JournalApiResponse>(`/api/erp/reports/journal?${buildQuery(appliedFilters, 1, size)}`);
    return res.table.rows;
  }, [appliedFilters, buildQuery, data]);

  const visibleColumns = useMemo(() => config.columns.filter((c) => c.visible), [config]);

  function columnValue(row: JournalRegisterRow, key: JournalColumnKey): string {
    switch (key) {
      case "date":
        return row.date;
      case "journalNo":
        return row.journalNo || "—";
      case "voucherNo":
        return row.voucherNo || "—";
      case "referenceNo":
        return row.referenceNo || "—";
      case "accountName":
        return row.accountName || row.accountCode || "—";
      case "customerName":
        return row.customerName || "—";
      case "description":
        return row.description || "—";
      case "debit":
        return row.debit ? numberFmt(row.debit) : "—";
      case "credit":
        return row.credit ? numberFmt(row.credit) : "—";
      case "currency":
        return row.currency || "—";
      case "usdRate":
        return row.usdRate ? numberFmt(row.usdRate) : "—";
      case "companyName":
        return row.companyName || "—";
      case "countryName":
        return row.countryName || "—";
      case "countryBranchName":
        return row.countryBranchName || "—";
      case "cityBranchName":
        return row.cityBranchName || "—";
      case "createdByName":
        return row.createdByName || "—";
      case "approvedByName":
        return row.approvedByName || "—";
      case "status":
        return row.status || "—";
      default:
        return "—";
    }
  }

  function viewOriginal(row: JournalRegisterRow) {
    // No single-batch/entry detail route exists for ledger_posting_batches anywhere in this
    // app (confirmed by codebase search) — the closest real existing view is the account's own
    // Ledger General Report. roznamcha entries DO have a real deep-link: the Super Admin
    // Roznamcha Report reads ?entryId= and auto-selects that voucher in its drawer.
    if (row.sourceTable === "roznamcha") {
      router.push(`/dashboard/roznamcha/super-admin?entryId=${row.entryId}`);
    } else if (row.accountId) {
      router.push(`/dashboard/ledger/general-report?ledgerId=${row.accountId}`);
    }
  }

  function buildPrintInput(rows: JournalRegisterRow[], autoPrint: boolean): UniversalPrintInput {
    const visible = config.columns.filter((c) => c.visible);
    return {
      title: s.t("title", "Journal Reporting"),
      subtitle: s.t("register_title", "Journal Register"),
      lang: s.lang,
      moduleType: "journal",
      orientation: "landscape",
      reportType: "register",
      scope: {
        dateRange: `${appliedFilters.fromDate} → ${appliedFilters.toDate}`,
        scopeLevel: data?.reportScope,
        country: context.country,
        branch: context.branchName,
        userName: context.userName
      },
      kpis: data
        ? [
            { label: s.t("kpi_opening_balance", "Opening Balance"), value: numberFmt(data.kpis.openingBalance), color: "slate" },
            { label: s.t("kpi_total_debit", "Total Debit"), value: numberFmt(data.kpis.totalDebit), color: "amber" },
            { label: s.t("kpi_total_credit", "Total Credit"), value: numberFmt(data.kpis.totalCredit), color: "emerald" },
            { label: s.t("kpi_closing_balance", "Closing Balance"), value: numberFmt(data.kpis.closingBalance), color: "blue" },
            { label: s.t("kpi_total_entries", "Total Journal Entries"), value: data.kpis.totalJournalEntries, color: "purple" }
          ]
        : [],
      filters: [
        { label: s.t("from_date", "From Date"), value: appliedFilters.fromDate },
        { label: s.t("to_date", "To Date"), value: appliedFilters.toDate }
      ],
      columns: visible.map((c) => ({
        key: c.key,
        label: columnLabel(s, c.key),
        format: c.key === "debit" || c.key === "credit" || c.key === "usdRate" ? ("currency" as const) : c.key === "date" ? ("date" as const) : ("text" as const)
      })),
      rows: rows.map((r) => Object.fromEntries(visible.map((c) => [c.key, columnValue(r, c.key)]))),
      totals: data ? { debit: numberFmt(data.totals.debit), credit: numberFmt(data.totals.credit) } : undefined,
      showSignatures: true,
      autoPrint
    };
  }

  async function withBusy(key: string, fn: () => Promise<void>) {
    setBusyAction(key);
    try {
      await fn();
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : s.t("error_loading", "Failed to load journal report data."));
    } finally {
      setBusyAction(null);
    }
  }

  const handlePreview = () => withBusy("preview", async () => openUniversalPrintReport(buildPrintInput(await fetchAllRows(), false)));
  const handlePrint = () => withBusy("print", async () => openUniversalPrintReport(buildPrintInput(await fetchAllRows(), false)));
  const handlePdf = () => withBusy("pdf", async () => openUniversalPrintReport(buildPrintInput(await fetchAllRows(), true)));

  const handleExcel = () =>
    withBusy("excel", async () => {
      const rows = await fetchAllRows();
      const visible = config.columns.filter((c) => c.visible);
      const header = visible.map((c) => columnLabel(s, c.key));
      const body = rows.map((r) => visible.map((c) => columnValue(r, c.key)));
      const csv = [header, ...body]
        .map((line) => line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
        .join("\r\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `journal-report-${appliedFilters.fromDate}_to_${appliedFilters.toDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatusMsg(s.t("excel_exported", "Excel (CSV) file downloaded."));
    });

  const handleEmailSend = () =>
    withBusy("email", async () => {
      const recipients = emailRecipients
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      if (!recipients.length) return;
      const rows = await fetchAllRows();
      const html = buildUniversalPrintHtml(buildPrintInput(rows, false));
      await apiPatch<{ success: boolean }>("/api/erp/reports/auto-email?action=send-now", {
        recipients,
        reportName: s.t("title", "Journal Reporting"),
        htmlBody: html
      });
      setStatusMsg(s.t("email_sent", "Report emailed successfully."));
      setShowEmail(false);
      setEmailRecipients("");
    });

  const handleSaveView = () =>
    withBusy("saveview", async () => {
      if (!saveViewName.trim()) return;
      await apiPost("/api/erp/reports/saved", {
        name: saveViewName.trim(),
        module: "journal_reporting",
        config: { filters: appliedFilters, reportConfig: config },
        isPublic: saveViewPublic
      });
      setStatusMsg(s.t("save_view_saved", "Report view saved."));
      setShowSaveView(false);
      setSaveViewName("");
      setSaveViewPublic(false);
      loadSavedViews();
    });

  function handleLoadView(view: SavedView) {
    if (view.config?.filters) {
      setFilters(view.config.filters);
      setAppliedFilters(view.config.filters);
      setPage(1);
    }
    if (view.config?.reportConfig) setConfig(normalizeJournalReportConfig(view.config.reportConfig));
    setShowSavedList(false);
  }

  const handleDeleteView = (id: string) =>
    withBusy("deleteview", async () => {
      await apiFetch(`/api/erp/reports/saved/${id}`, { method: "DELETE" });
      loadSavedViews();
    });

  useEffect(() => {
    if (!statusMsg) return;
    const t = setTimeout(() => setStatusMsg(null), 4000);
    return () => clearTimeout(t);
  }, [statusMsg]);

  const kpis = data?.kpis;
  const cardMeta: Array<{ key: keyof NonNullable<typeof kpis>; labelKey: string; fallback: string; tone: string }> = [
    { key: "openingBalance", labelKey: "kpi_opening_balance", fallback: "Opening Balance", tone: "text-slate-700" },
    { key: "totalDebit", labelKey: "kpi_total_debit", fallback: "Total Debit", tone: "text-amber-600" },
    { key: "totalCredit", labelKey: "kpi_total_credit", fallback: "Total Credit", tone: "text-emerald-600" },
    { key: "closingBalance", labelKey: "kpi_closing_balance", fallback: "Closing Balance", tone: "text-blue-600" },
    { key: "totalJournalEntries", labelKey: "kpi_total_entries", fallback: "Total Journal Entries", tone: "text-purple-600" },
    { key: "approvedEntries", labelKey: "kpi_approved_entries", fallback: "Approved Entries", tone: "text-emerald-600" },
    { key: "pendingEntries", labelKey: "kpi_pending_entries", fallback: "Pending Entries", tone: "text-orange-600" }
  ];

  const totalPages = data ? Math.max(1, Math.ceil(data.table.totalCount / PAGE_SIZE)) : 1;

  return (
    <div dir={s.dir} className="space-y-5 p-4 md:p-6">
      {/* Header / context banner */}
      <div className="rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">{s.t("title", "Journal Reporting")}</h1>
            <p className="text-sm text-slate-300">{s.t("subtitle", "One dynamic report — every card, chart and row follows the active filters")}</p>
          </div>
          <div className="rounded-full bg-white/10 px-3 py-1 text-xs">
            {context.scopeLabel || context.accessScope} · {[context.branchName, context.city, context.country].filter(Boolean).join(", ")}
          </div>
        </div>
      </div>

      {statusMsg && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
          {statusMsg}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{s.t("date_range", "Date Range")}:</span>
          {DATE_PRESETS.map(([value, key, fallback]) => (
            <button
              key={value}
              type="button"
              onClick={() => applyPreset(value)}
              className={`rounded-full border px-3 py-1 text-xs ${
                filters.datePreset === value
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {s.t(key, fallback)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          <label className="flex flex-col text-xs text-slate-500">
            {s.t("from_date", "From Date")}
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => setFilter("fromDate", e.target.value)}
              className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-500">
            {s.t("to_date", "To Date")}
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => setFilter("toDate", e.target.value)}
              className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>

          <SelectFilter label={s.t("filter_country", "Country")} value={filters.countryId} onChange={(v) => setFilter("countryId", v)} options={meta?.countries ?? []} allLabel={s.t("filter_all", "All")} />
          <SelectFilter label={s.t("filter_country_branch", "Country Branch (Main Branch)")} value={filters.countryBranchId} onChange={(v) => setFilter("countryBranchId", v)} options={meta?.countryBranches ?? []} allLabel={s.t("filter_all", "All")} />
          <SelectFilter label={s.t("filter_city_branch", "City Branch")} value={filters.cityBranchId} onChange={(v) => setFilter("cityBranchId", v)} options={meta?.cityBranches ?? []} allLabel={s.t("filter_all", "All")} />
          <SelectFilter label={s.t("filter_company", "Company")} value={filters.companyId} onChange={(v) => setFilter("companyId", v)} options={meta?.companies ?? []} allLabel={s.t("filter_all", "All")} />
          <SelectFilter label={s.t("filter_account", "Account / Ledger")} value={filters.ledgerId} onChange={(v) => setFilter("ledgerId", v)} options={meta?.accounts ?? []} allLabel={s.t("filter_all", "All")} />
          <SelectFilter label={s.t("filter_customer", "Customer / Supplier")} value={filters.customerId} onChange={(v) => setFilter("customerId", v)} options={meta?.customers ?? []} allLabel={s.t("filter_all", "All")} />
          <SelectStringFilter label={s.t("filter_journal_type", "Journal Type")} value={filters.journalType} onChange={(v) => setFilter("journalType", v)} options={meta?.journalTypes ?? []} allLabel={s.t("filter_all", "All")} />
          <SelectStringFilter label={s.t("filter_voucher_type", "Voucher Type")} value={filters.voucherType} onChange={(v) => setFilter("voucherType", v)} options={meta?.voucherTypes ?? []} allLabel={s.t("filter_all", "All")} />
          <SelectStringFilter label={s.t("filter_currency", "Currency")} value={filters.currency} onChange={(v) => setFilter("currency", v)} options={meta?.currencies ?? []} allLabel={s.t("filter_all", "All")} />
          <SelectFilter label={s.t("filter_created_by", "Created By")} value={filters.createdBy} onChange={(v) => setFilter("createdBy", v)} options={meta?.users ?? []} allLabel={s.t("filter_all", "All")} />
          <SelectFilter label={s.t("filter_approved_by", "Approved By")} value={filters.approvedBy} onChange={(v) => setFilter("approvedBy", v)} options={meta?.users ?? []} allLabel={s.t("filter_all", "All")} />

          <label className="flex flex-col text-xs text-slate-500">
            {s.t("filter_approval_status", "Approval Status")}
            <select value={filters.approvalStatus} onChange={(e) => setFilter("approvalStatus", e.target.value)} className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800">
              <option value="">{s.t("filter_all", "All")}</option>
              <option value="approved">{s.t("approval_approved", "Approved")}</option>
              <option value="pending">{s.t("approval_pending", "Pending")}</option>
            </select>
          </label>

          <label className="flex flex-col text-xs text-slate-500">
            {s.t("filter_status", "Transaction Status")}
            <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800">
              <option value="">{s.t("filter_all", "All")}</option>
              <option value="draft">{s.t("status_draft", "Draft")}</option>
              <option value="posted">{s.t("status_posted", "Posted")}</option>
              <option value="cancelled">{s.t("status_cancelled", "Cancelled")}</option>
            </select>
          </label>

          <label className="flex flex-col text-xs text-slate-500">
            {s.t("filter_dr_cr", "Debit / Credit")}
            <select value={filters.drCr} onChange={(e) => setFilter("drCr", e.target.value)} className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800">
              <option value="">{s.t("filter_all", "All")}</option>
              <option value="debit">{s.t("dr_cr_debit", "Debit")}</option>
              <option value="credit">{s.t("dr_cr_credit", "Credit")}</option>
            </select>
          </label>

          <label className="flex flex-col text-xs text-slate-500">
            {s.t("filter_reference_no", "Reference Number")}
            <input
              type="text"
              value={filters.referenceNo}
              onChange={(e) => setFilter("referenceNo", e.target.value)}
              className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={applyFilters} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">
            {s.t("apply_filters", "Apply Filters")}
          </button>
          <button type="button" onClick={resetFilters} className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            {s.t("reset_filters", "Reset Filters")}
          </button>
        </div>
      </div>

      {/* Actions toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <ToolbarButton onClick={handlePreview} busy={busyAction === "preview"}>{s.t("action_preview", "Preview")}</ToolbarButton>
        <ToolbarButton onClick={handlePrint} busy={busyAction === "print"}>{s.t("action_print", "Print")}</ToolbarButton>
        <ToolbarButton onClick={handlePdf} busy={busyAction === "pdf"}>{s.t("action_pdf", "PDF")}</ToolbarButton>
        <ToolbarButton onClick={handleExcel} busy={busyAction === "excel"}>{s.t("action_excel", "Excel")}</ToolbarButton>
        <ToolbarButton onClick={() => setShowEmail(true)}>{s.t("action_email", "Email")}</ToolbarButton>
        <ToolbarButton onClick={() => setShowSaveView(true)}>{s.t("action_save_view", "Save View")}</ToolbarButton>
        <ToolbarButton onClick={() => setShowSavedList((v) => !v)}>{s.t("saved_views", "Saved Report Views")}</ToolbarButton>
        <ToolbarButton onClick={() => setShowCustomize(true)}>{s.t("action_customize", "Customize Report")}</ToolbarButton>
        <ToolbarButton onClick={() => load(appliedFilters, page)} busy={loading}>{s.t("action_refresh", "Refresh")}</ToolbarButton>
      </div>

      {showSavedList && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          {savedViews.length === 0 ? (
            <p className="text-sm text-slate-400">{s.t("saved_views_none", "No saved views yet.")}</p>
          ) : (
            <ul className="space-y-1">
              {savedViews.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 rounded border border-slate-100 px-3 py-1.5 text-sm dark:border-slate-800">
                  <span>{v.name}</span>
                  <span className="flex gap-2">
                    <button type="button" onClick={() => handleLoadView(v)} className="text-blue-600 hover:underline">
                      {s.t("saved_views_load", "Load")}
                    </button>
                    <button type="button" onClick={() => handleDeleteView(v.id)} className="text-red-600 hover:underline">
                      {s.t("saved_views_delete", "Delete")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {cardMeta
          .filter((c) => config.visibleCards.includes(c.key as any))
          .map((c) => (
            <div key={c.key} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">{s.t(c.labelKey, c.fallback)}</p>
              <p className={`mt-1 text-lg font-semibold ${c.tone}`}>{kpis ? numberFmt(kpis[c.key] as number) : "—"}</p>
            </div>
          ))}
      </div>

      {/* Charts */}
      {data && <JournalReportingCharts data={data.charts} visibleCharts={config.visibleCharts} s={s} />}

      {/* Register table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{s.t("register_title", "Journal Register")}</h2>
          {loading && <span className="text-xs text-slate-400">{s.t("loading", "Loading journal register…")}</span>}
        </div>
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              {visibleColumns.map((c) => (
                <th key={c.key} style={{ width: c.width }} className={`px-3 py-2 font-medium text-slate-600 dark:text-slate-300 ${s.textStart}`}>
                  {columnLabel(s, c.key)}
                </th>
              ))}
              <th className={`px-3 py-2 font-medium text-slate-600 dark:text-slate-300 ${s.textStart}`}>{s.t("view_original", "View Original")}</th>
            </tr>
          </thead>
          <tbody>
            {(data?.table.rows.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="px-3 py-6 text-center text-slate-400">
                  {s.t("no_records", "No journal entries found for the selected filters.")}
                </td>
              </tr>
            ) : (
              data!.table.rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                  {visibleColumns.map((c) => (
                    <td key={c.key} style={{ width: c.width }} className="px-3 py-2 text-slate-700 dark:text-slate-300">
                      {columnValue(row, c.key)}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => viewOriginal(row)} className="text-xs text-blue-600 hover:underline">
                      {s.t("view_original", "View Original")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {config.showTotalsRow && data && data.table.rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold dark:border-slate-700 dark:bg-slate-800">
                {visibleColumns.map((c, idx) => (
                  <td key={c.key} className="px-3 py-2 text-slate-700 dark:text-slate-200">
                    {idx === 0
                      ? s.t("total_row", "Totals")
                      : c.key === "debit"
                        ? numberFmt(data.totals.debit)
                        : c.key === "credit"
                          ? numberFmt(data.totals.credit)
                          : ""}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pagination */}
      {data && data.table.totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            {data.table.rows.length} / {data.table.totalCount} {s.t("entries_label", "entries")}
          </span>
          <div className="flex gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40 dark:border-slate-700">
              ‹
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40 dark:border-slate-700">
              ›
            </button>
          </div>
        </div>
      )}

      {showCustomize && (
        <JournalReportingCustomize
          s={s}
          config={config}
          onClose={() => setShowCustomize(false)}
          onApply={(next) => {
            setConfig(next);
            setShowCustomize(false);
          }}
        />
      )}

      {showSaveView && (
        <Modal onClose={() => setShowSaveView(false)} dir={s.dir}>
          <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">{s.t("save_view_title", "Save Report View")}</h2>
          <label className="mb-2 block text-sm">
            {s.t("save_view_name", "View Name")}
            <input
              type="text"
              value={saveViewName}
              onChange={(e) => setSaveViewName(e.target.value)}
              placeholder={s.t("save_view_name_placeholder", "e.g. Daily Journal, Dubai Branch, USD Journal")}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <label className="mb-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={saveViewPublic} onChange={(e) => setSaveViewPublic(e.target.checked)} />
            {s.t("save_view_public", "Share with all users (public)")}
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowSaveView(false)} className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700">
              {s.t("save_view_cancel", "Cancel")}
            </button>
            <button type="button" onClick={handleSaveView} disabled={busyAction === "saveview" || !saveViewName.trim()} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {s.t("save_view_save", "Save")}
            </button>
          </div>
        </Modal>
      )}

      {showEmail && (
        <Modal onClose={() => setShowEmail(false)} dir={s.dir}>
          <h2 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-100">{s.t("email_title", "Email Report")}</h2>
          <label className="mb-4 block text-sm">
            {s.t("email_recipients", "Recipients (comma-separated)")}
            <input
              type="text"
              value={emailRecipients}
              onChange={(e) => setEmailRecipients(e.target.value)}
              placeholder={s.t("email_recipients_placeholder", "name@example.com, name2@example.com")}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowEmail(false)} className="rounded border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700">
              {s.t("email_cancel", "Cancel")}
            </button>
            <button
              type="button"
              onClick={handleEmailSend}
              disabled={busyAction === "email" || !emailRecipients.trim()}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busyAction === "email" ? s.t("email_sending", "Sending…") : s.t("email_send", "Send")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
  allLabel
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: ReportMetaOption[];
  allLabel: string;
}) {
  return (
    <label className="flex flex-col text-xs text-slate-500">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800">
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SelectStringFilter({
  label,
  value,
  onChange,
  options,
  allLabel
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  allLabel: string;
}) {
  return (
    <label className="flex flex-col text-xs text-slate-500">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800">
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToolbarButton({ children, onClick, busy }: { children: React.ReactNode; onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

function Modal({ children, onClose, dir }: { children: React.ReactNode; onClose: () => void; dir: "rtl" | "ltr" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div dir={dir} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
