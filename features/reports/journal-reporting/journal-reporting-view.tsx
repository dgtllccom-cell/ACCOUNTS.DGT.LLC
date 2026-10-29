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
import { ErpDatePicker } from "@/components/ui/erp-date-picker";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  Download,
  Eye,
  Filter,
  Printer,
  RefreshCw,
  SlidersHorizontal,
  ExternalLink,
  X
} from "lucide-react";
import { Th } from "@/components/ui/translated-th";

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
  accountNumber: string | null;
  accountName: string | null;
  accountType: string | null;
  accountStatus: string | null;
  customerId: string | null;
  customerName: string | null;
  companyName: string | null;
  debit: number;
  credit: number;
  currency: string;
  usdRate: number;
  finalBalance: number;
  balanceDirection: "DR" | "CR" | "—";
  entryType: string | null;
  countryName: string | null;
  countryBranchName: string | null;
  cityBranchName: string | null;
  branchName: string | null;
  accountBranchName: string | null;
  transactionBranchName: string | null;
  contactInfo: string | null;
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [selectedDetailRow, setSelectedDetailRow] = useState<JournalRegisterRow | null>(null);

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
      case "voucherNo":
        return row.voucherNo || "—";
      case "journalNo":
        return row.journalNo || "—";
      case "referenceNo":
        return row.referenceNo || "—";
      case "accountCode":
        return row.accountCode || "—";
      case "accountNumber":
        return row.accountNumber || "—";
      case "accountName":
        return row.accountName || row.accountCode || "—";
      case "branchName":
        return row.branchName || row.cityBranchName || row.countryBranchName || "—";
      case "entryType":
        return row.entryType || "—";
      case "customerName":
        return row.customerName || "—";
      case "description":
        return row.description || "—";
      case "debit":
        return row.debit ? numberFmt(row.debit) : "—";
      case "credit":
        return row.credit ? numberFmt(row.credit) : "—";
      case "finalBalance":
        return numberFmt(row.finalBalance);
      case "drCr":
        return row.balanceDirection;
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

  function renderCell(row: JournalRegisterRow, key: JournalColumnKey) {
    switch (key) {
      case "credit":
        return (
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {row.credit ? numberFmt(row.credit) : "—"}
          </span>
        );
      case "debit":
        return (
          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
            {row.debit ? numberFmt(row.debit) : "—"}
          </span>
        );
      case "finalBalance":
        return (
          <span className="font-mono font-black text-blue-600 dark:text-blue-400">
            {numberFmt(row.finalBalance)}
          </span>
        );
      case "drCr":
        if (row.balanceDirection === "DR") {
          return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-black bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800 whitespace-nowrap">
              DR
            </span>
          );
        }
        if (row.balanceDirection === "CR") {
          return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
              CR
            </span>
          );
        }
        return <span className="text-slate-400">—</span>;
      case "accountCode":
        return (
          <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
            {row.accountCode || "—"}
          </span>
        );
      case "accountNumber":
        return (
          <span className="font-mono text-slate-600 dark:text-slate-400">
            {row.accountNumber || "—"}
          </span>
        );
      case "voucherNo":
        return (
          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
            {row.voucherNo || "—"}
          </span>
        );
      case "journalNo":
        return (
          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
            {row.journalNo || "—"}
          </span>
        );
      case "branchName":
        return (
          <span className="font-medium text-slate-800 dark:text-slate-200">
            {row.branchName || row.cityBranchName || row.countryBranchName || "—"}
          </span>
        );
      case "entryType":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 whitespace-nowrap">
            {row.entryType || "Journal"}
          </span>
        );
      case "description":
        return (
          <div className="max-w-[200px] truncate text-slate-600 dark:text-slate-400" title={row.description || ""}>
            {row.description || "—"}
          </div>
        );
      case "status":
        return (
          <span
            className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase",
              row.status === "posted"
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : row.status === "cancelled"
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            )}
          >
            {row.status}
          </span>
        );
      default:
        return columnValue(row, key);
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
        format: c.key === "debit" || c.key === "credit" || c.key === "finalBalance" || c.key === "usdRate" ? ("currency" as const) : c.key === "date" ? ("date" as const) : ("text" as const)
      })),
      rows: rows.map((r) => Object.fromEntries(visible.map((c) => [c.key, columnValue(r, c.key)]))),
      totals: data ? { debit: numberFmt(data.totals.debit), credit: numberFmt(data.totals.credit), balance: numberFmt(data.totals.balance) } : undefined,
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
    <div dir={s.dir} className="w-full max-w-none px-4 sm:px-6 space-y-5 pb-12">
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

      {/* Filters (Collapsible) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors",
                filtersOpen
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>{filtersOpen ? s.t("hide_filters", "Hide Filters") : s.t("filters", "Filters")}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", filtersOpen && "rotate-180")} />
            </button>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              📅 {filters.fromDate || "All"} → {filters.toDate || "All"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {DATE_PRESETS.map(([value, key, fallback]) => (
              <button
                key={value}
                type="button"
                onClick={() => applyPreset(value)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                  filters.datePreset === value
                    ? "border-blue-600 bg-blue-600 text-white font-bold"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {s.t(key, fallback)}
              </button>
            ))}
          </div>
        </div>

        {filtersOpen && (
          <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
              <div className="col-span-2 flex flex-col text-xs text-slate-500">
                <span className="mb-1 font-semibold">{s.t("date_range", "Date Range")}</span>
                <ErpDatePicker
                  mode="range"
                  lang={s.lang}
                  size="sm"
                  applyLabel="update"
                  value={{ from: filters.fromDate || null, to: filters.toDate || null }}
                  onApply={(v) => {
                    setFilter("fromDate", v.from ?? "");
                    setFilter("toDate", v.to ?? "");
                  }}
                />
              </div>

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
              <button type="button" onClick={applyFilters} className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 shadow-sm">
                {s.t("apply_filters", "Apply Filters")}
              </button>
              <button type="button" onClick={resetFilters} className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                {s.t("reset_filters", "Reset Filters")}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Actions toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Actions / Export Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setActionsMenuOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{s.t("actions_export", "Actions / Export")}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {actionsMenuOpen && (
              <div
                className="absolute left-0 top-full mt-1.5 z-30 w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1 text-xs"
                onClick={() => setActionsMenuOpen(false)}
              >
                <button
                  type="button"
                  onClick={handlePreview}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                >
                  <Eye className="h-3.5 w-3.5 text-blue-600" />
                  <span>{s.t("action_preview", "Preview Report")}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-600" />
                  <span>{s.t("action_print", "Print Report")}</span>
                </button>
                <button
                  type="button"
                  onClick={handlePdf}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                >
                  <Download className="h-3.5 w-3.5 text-red-600" />
                  <span>{s.t("action_pdf", "Export to PDF")}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExcel}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{s.t("action_excel", "Export to Excel")}</span>
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                <button
                  type="button"
                  onClick={() => setShowEmail(true)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                >
                  <span>📧</span>
                  <span>{s.t("action_email", "Email Report")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSaveView(true)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 font-medium"
                >
                  <span>💾</span>
                  <span>{s.t("action_save_view", "Save View")}</span>
                </button>
              </div>
            )}
          </div>

          <ToolbarButton onClick={() => setShowCustomize(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5 me-1 inline" />
            {s.t("action_customize", "Customize Columns")}
          </ToolbarButton>
          <ToolbarButton onClick={() => setShowSavedList((v) => !v)}>
            {s.t("saved_views", "Saved Views")} ({savedViews.length})
          </ToolbarButton>
        </div>

        <div>
          <ToolbarButton onClick={() => load(appliedFilters, page)} busy={loading}>
            <RefreshCw className={cn("h-3.5 w-3.5 me-1 inline", loading && "animate-spin")} />
            {s.t("action_refresh", "Refresh")}
          </ToolbarButton>
        </div>
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
        <table className="w-full min-w-[1100px] text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              {visibleColumns.map((c) => (
                <Th
                  key={c.key}
                  style={{ width: c.width }}
                  className={cn(
                    "px-2.5 py-2 font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[11px]",
                    ["debit", "credit", "finalBalance", "usdRate"].includes(c.key) ? "text-right" : ["drCr", "date", "currency", "status"].includes(c.key) ? "text-center" : s.textStart
                  )}
                >
                  {columnLabel(s, c.key)}
                </Th>
              ))}
              <Th className={`px-2.5 py-2 font-semibold text-slate-700 dark:text-slate-200 text-center uppercase tracking-wider text-[11px]`}>{s.t("view_original", "Actions")}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {(data?.table.rows.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="px-3 py-8 text-center text-slate-400">
                  {s.t("no_records", "No journal entries found for the selected filters.")}
                </td>
              </tr>
            ) : (
              data!.table.rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedDetailRow(row)}
                  className="hover:bg-blue-50/50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                >
                  {visibleColumns.map((c) => (
                    <td
                      key={c.key}
                      style={{ width: c.width }}
                      className={cn(
                        "px-2.5 py-1.5 text-slate-700 dark:text-slate-300 whitespace-nowrap",
                        ["debit", "credit", "finalBalance", "usdRate"].includes(c.key) ? "text-right font-mono" : ["drCr", "date", "currency", "status"].includes(c.key) ? "text-center" : "text-left"
                      )}
                    >
                      {renderCell(row, c.key)}
                    </td>
                  ))}
                  <td className="px-2.5 py-1.5 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailRow(row)}
                        className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 whitespace-nowrap"
                        title={s.t("view_details", "View Details")}
                      >
                        <Eye className="h-3 w-3" />
                        <span>{s.t("view_action", "View")}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => viewOriginal(row)}
                        className="text-[11px] text-slate-500 hover:text-blue-600 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        title={s.t("open_source", "Open Source")}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {config.showTotalsRow && data && data.table.rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-xs dark:border-slate-700 dark:bg-slate-800">
                {visibleColumns.map((c, idx) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-2.5 py-2 text-slate-800 dark:text-slate-100",
                      ["debit", "credit", "finalBalance"].includes(c.key) ? "text-right font-mono" : idx === 0 ? "text-left" : "text-center"
                    )}
                  >
                    {idx === 0 ? (
                      <span className="uppercase tracking-wider font-extrabold text-[11px] text-slate-900 dark:text-slate-100">
                        {s.t("total_row", "Totals")}
                      </span>
                    ) : c.key === "debit" ? (
                      <span className="text-rose-600 dark:text-rose-400 font-mono font-bold">
                        {numberFmt(data.totals.debit)}
                      </span>
                    ) : c.key === "credit" ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                        {numberFmt(data.totals.credit)}
                      </span>
                    ) : c.key === "finalBalance" ? (
                      <span className="text-blue-600 dark:text-blue-400 font-mono font-black">
                        {numberFmt(data.totals.balance)}
                      </span>
                    ) : (
                      ""
                    )}
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

      {selectedDetailRow && (
        <Modal onClose={() => setSelectedDetailRow(null)} dir={s.dir}>
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Transaction Detail — {selectedDetailRow.referenceNo || selectedDetailRow.voucherNo || selectedDetailRow.journalNo || selectedDetailRow.id.slice(0, 8)}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedDetailRow(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-lg border bg-slate-50 dark:bg-slate-900/50 p-3">
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-bold block">Date</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedDetailRow.date}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-bold block">Voucher No</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{selectedDetailRow.voucherNo || "—"}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-bold block">Journal No</span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{selectedDetailRow.journalNo || "—"}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-bold block">Entry Type</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{selectedDetailRow.entryType || selectedDetailRow.sourceTable}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-bold block">Account Code</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{selectedDetailRow.accountCode || "—"}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-bold block">Account Number</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{selectedDetailRow.accountNumber || "—"}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-bold block">Account Name</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{selectedDetailRow.accountName || "—"}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-bold block">Account Type / Status</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {selectedDetailRow.accountType || "General"} · <span className="text-emerald-600 font-bold">{selectedDetailRow.accountStatus || "ACTIVE"}</span>
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-bold block">Transaction Branch</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{selectedDetailRow.transactionBranchName || selectedDetailRow.branchName || "—"}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-bold block">Account Branch</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedDetailRow.accountBranchName || selectedDetailRow.branchName || "—"}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-bold block">Country</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedDetailRow.countryName || "—"}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-bold block">Currency & Rate</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{selectedDetailRow.currency} (USD Rate: {numberFmt(selectedDetailRow.usdRate)})</span>
              </div>
            </div>

            {/* Financial Summary Box */}
            <div className="grid grid-cols-4 gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3">
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-bold block">Total Debit</span>
                <span className="font-mono font-bold text-sm text-rose-600 dark:text-rose-400">
                  {selectedDetailRow.debit ? numberFmt(selectedDetailRow.debit) : "0.00"} {selectedDetailRow.currency}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-bold block">Total Credit</span>
                <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  {selectedDetailRow.credit ? numberFmt(selectedDetailRow.credit) : "0.00"} {selectedDetailRow.currency}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-bold block">Final Balance</span>
                <span className="font-mono font-black text-sm text-blue-600 dark:text-blue-400">
                  {numberFmt(selectedDetailRow.finalBalance)} {selectedDetailRow.currency}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground uppercase font-bold block">Balance Type</span>
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-black", selectedDetailRow.balanceDirection === "DR" ? "bg-rose-100 text-rose-700" : selectedDetailRow.balanceDirection === "CR" ? "bg-emerald-100 text-emerald-700" : "text-slate-400")}>
                  {selectedDetailRow.balanceDirection}
                </span>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground uppercase font-bold block">Narration / Description</span>
              <p className="mt-1 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border rounded p-2.5 leading-relaxed">
                {selectedDetailRow.description || "No description provided."}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-600 dark:text-slate-400 text-[11px] pt-1">
              <div>Created By: <b className="text-slate-800 dark:text-slate-200">{selectedDetailRow.createdByName || "—"}</b></div>
              <div>Approved By: <b className="text-slate-800 dark:text-slate-200">{selectedDetailRow.approvedByName || "—"}</b></div>
              <div>Approval Status: <b className="text-slate-800 dark:text-slate-200 uppercase">{selectedDetailRow.approvalStatus}</b></div>
              <div>Contact Info: <b className="text-slate-800 dark:text-slate-200">{selectedDetailRow.contactInfo || "—"}</b></div>
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                type="button"
                onClick={() => setSelectedDetailRow(null)}
                className="rounded border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  viewOriginal(selectedDetailRow);
                  setSelectedDetailRow(null);
                }}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 flex items-center gap-1.5"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Original Source</span>
              </button>
            </div>
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
