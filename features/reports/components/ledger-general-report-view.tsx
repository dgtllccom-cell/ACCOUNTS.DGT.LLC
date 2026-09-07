"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Banknote, Globe2 } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet } from "@/lib/api/client";
import type { ReportContext } from "@/lib/reports/resolve-report-context";
import {
  UniversalReportShell,
  type ReportFilterState,
  type ReportMetaOption,
  type ReportCard,
} from "./universal-report-shell";
import { openUniversalReport, type UrpColumn } from "@/lib/reports/universal-report-print";

type LedgerRow = {
  ledgerId: string; ledgerCode: string; ledgerName: string; ledgerCurrency: string;
  normalBalance: string; isActive: boolean;
  currentBalance: number; debitTotal: number; creditTotal: number;
  countryName: string | null; countryBranchName: string | null; cityBranchName: string | null;
};
type LedgerPayload = { summary: Record<string, any>; rows: LedgerRow[]; reportScope: string };

const EMPTY: ReportFilterState = { dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "" };
const money = (n: unknown) => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** report scope the caller is allowed to request — clamped by the server anyway */
function scopeFor(ctx: ReportContext): "super_admin" | "country" | "branch" {
  if (ctx.accessScope === "Global") return "super_admin";
  if (ctx.cityBranchId || ctx.countryBranchId) return "branch";
  return "country";
}

export function LedgerGeneralReportView({
  context,
  countries,
}: {
  context: ReportContext;
  countries: ReportMetaOption[];
}) {
  const s = useErpScreen("lgrep");
  const reportScope = scopeFor(context);
  const [data, setData] = useState<LedgerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState("ledger-general");
  const [filters, setFilters] = useState<ReportFilterState>(() => {
    const y = new Date().getFullYear();
    return { ...EMPTY, dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` };
  });
  const [applied, setApplied] = useState<ReportFilterState>(filters);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ reportScope });
      if (applied.dateFrom) qs.set("startDate", applied.dateFrom);
      if (applied.dateTo) qs.set("endDate", applied.dateTo);
      if (applied.countryId) qs.set("countryId", applied.countryId);
      const res = await apiGet<LedgerPayload>(`/api/erp/accounting/reports/ledger/general?${qs.toString()}`);
      setData(res);
    } catch {
      setData({ summary: {}, rows: [], reportScope });
    } finally {
      setLoading(false);
    }
  }, [applied, reportScope]);
  useEffect(() => { void load(); }, [load]);

  const sm = data?.summary ?? {};
  const rows = useMemo(() => {
    let r = data?.rows ?? [];
    if (applied.status === "active") r = r.filter((x) => x.isActive);
    if (applied.status === "inactive") r = r.filter((x) => !x.isActive);
    return r;
  }, [data, applied.status]);

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "financial",
      title: s.t("card_financial", "Ledger Financial Summary"),
      subtitle: s.t("card_financial_sub", "USD-consolidated across currencies"),
      icon: <Banknote className="h-4 w-4" />,
      accent: "emerald",
      rows: [
        { label: s.t("f_total_ledgers", "Total Ledgers"), value: sm.totalLedgers ?? rows.length, mono: true },
        { label: s.t("f_active", "Active Ledgers"), value: sm.activeLedgers ?? 0, tone: "positive", mono: true },
        { label: s.t("f_entries", "Total Entries"), value: sm.entries ?? 0, mono: true },
        { label: s.t("f_usd_debit", "Total Debit (USD)"), value: money(sm.usdDebit), tone: "negative", mono: true },
        { label: s.t("f_usd_credit", "Total Credit (USD)"), value: money(sm.usdCredit), tone: "positive", mono: true },
      ],
      footer: { label: s.t("f_usd_balance", "Net Balance (USD)"), value: money(sm.usdBalance), tone: "strong" },
    },
    {
      key: "local",
      title: s.t("card_local", "Local & Daily Movement"),
      subtitle: s.t("card_local_sub", "Raw local-currency totals + today"),
      icon: <BookOpen className="h-4 w-4" />,
      accent: "purple",
      rows: [
        { label: s.t("l_debit", "Local Debit"), value: money(sm.debit), mono: true },
        { label: s.t("l_credit", "Local Credit"), value: money(sm.credit), mono: true },
        { label: s.t("l_daily_entries", "Entries Today"), value: sm.dailyEntries ?? 0, mono: true },
        { label: s.t("l_display_ccy", "Display Currency"), value: sm.displayCurrency ?? "USD" },
        { label: s.t("l_dominant", "Dominant Currency"), value: sm.dominantCurrency ?? "—" },
        { label: s.t("l_mixed", "Mixed Currencies"), value: sm.mixedLocalCurrency ? s.t("yes", "Yes") : s.t("no", "No"), tone: sm.mixedLocalCurrency ? "muted" : "default" },
      ],
    },
    {
      key: "coverage",
      title: s.t("card_coverage", "Country / Branch Coverage"),
      subtitle: s.t("card_coverage_sub", "Where these ledgers sit"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("c_countries", "Countries"), value: new Set(rows.map((r) => r.countryName).filter(Boolean)).size, mono: true },
        { label: s.t("c_main", "Main Branches"), value: new Set(rows.map((r) => r.countryBranchName).filter(Boolean)).size, mono: true },
        { label: s.t("c_city", "City Branches"), value: new Set(rows.map((r) => r.cityBranchName).filter(Boolean)).size, mono: true },
        { label: s.t("c_currencies", "Ledger Currencies"), value: new Set(rows.map((r) => r.ledgerCurrency)).size, mono: true },
      ],
      footer: { label: s.t("c_scope", "Report Scope"), value: (data?.reportScope ?? reportScope).replace(/_/g, " ") },
    },
  ], [s, sm, rows, data, reportScope]);

  const cols = [
    { key: "ledgerCode", label: s.t("col_code", "Ledger Code"), align: "start" as const },
    { key: "ledgerName", label: s.t("col_name", "Ledger Name"), align: "start" as const },
    { key: "ledgerCurrency", label: s.t("col_ccy", "Currency"), align: "center" as const },
    { key: "countryName", label: s.t("col_country", "Country"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.countryName || "—") },
    { key: "branch", label: s.t("col_branch", "Branch"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.cityBranchName || r.countryBranchName || "—") },
    { key: "debitTotal", label: s.t("col_debit", "Debit"), align: "end" as const, render: (r: Record<string, unknown>) => money(r.debitTotal) },
    { key: "creditTotal", label: s.t("col_credit", "Credit"), align: "end" as const, render: (r: Record<string, unknown>) => money(r.creditTotal) },
    { key: "currentBalance", label: s.t("col_balance", "Balance"), align: "end" as const, render: (r: Record<string, unknown>) => money(r.currentBalance) },
    { key: "isActive", label: s.t("col_status", "Status"), align: "center" as const, render: (r: Record<string, unknown>) => (r.isActive ? s.t("st_active", "Active") : s.t("st_inactive", "Inactive")) },
  ];

  const printInput = () => {
    const pdfCols: UrpColumn[] = [
      { key: "ledgerCode", label: s.t("col_code", "Ledger Code") },
      { key: "ledgerName", label: s.t("col_name", "Ledger Name") },
      { key: "ledgerCurrency", label: s.t("col_ccy", "Currency"), align: "center" },
      { key: "countryLabel", label: s.t("col_country", "Country") },
      { key: "branchLabel", label: s.t("col_branch", "Branch") },
      { key: "debitTotal", label: s.t("col_debit", "Debit"), align: "end", format: "currency" },
      { key: "creditTotal", label: s.t("col_credit", "Credit"), align: "end", format: "currency" },
      { key: "currentBalance", label: s.t("col_balance", "Balance"), align: "end", format: "currency" },
      { key: "statusLabel", label: s.t("col_status", "Status"), align: "center" },
    ];
    const prows = rows.map((r) => ({
      ...r,
      countryLabel: r.countryName || "—",
      branchLabel: r.cityBranchName || r.countryBranchName || "—",
      statusLabel: r.isActive ? s.t("st_active", "Active") : s.t("st_inactive", "Inactive"),
    }));
    return {
      lang: s.lang,
      title: s.t("title", "General Ledger Report"),
      subtitle: s.t("subtitle", "All ledgers, USD-consolidated"),
      fileSlug: "general-ledger-report",
      orientation: "landscape" as const,
      branchUser: {
        country: context.country, state: context.state, city: context.city,
        branchName: context.branchName, branchCode: context.branchCode,
        userId: context.userId, userName: context.userName, role: context.role,
        accessScope: context.accessScope, dateTime: new Date().toLocaleString("en-GB"), online: context.online,
      },
      cards: cards.map((c) => ({ title: c.title, subtitle: c.subtitle, rows: c.rows.map((r) => ({ ...r })), footer: c.footer })),
      appliedFilters: [
        { label: s.tGlobal("urs.f_date_range", "Date Range"), value: `${applied.dateFrom} → ${applied.dateTo}` },
        applied.countryId ? { label: s.tGlobal("urs.f_country", "Country"), value: countries.find((c) => c.id === applied.countryId)?.name ?? applied.countryId } : null,
      ].filter(Boolean) as Array<{ label: string; value: string }>,
      table: {
        title: s.t("table_title", "Ledger Balances"),
        columns: pdfCols,
        rows: prows,
        totals: {
          debitTotal: rows.reduce((a, r) => a + (Number(r.debitTotal) || 0), 0),
          creditTotal: rows.reduce((a, r) => a + (Number(r.creditTotal) || 0), 0),
          currentBalance: rows.reduce((a, r) => a + (Number(r.currentBalance) || 0), 0),
        },
      },
      labels: {
        branchUser: s.tGlobal("urs.card_branch_user", "Branch & User Details"),
        status: s.tGlobal("urs.bud_status", "Status"), online: s.tGlobal("urs.bud_online", "Online"), offline: s.tGlobal("urs.bud_offline", "Offline"),
        country: s.tGlobal("urs.bud_country", "Country"), state: s.tGlobal("urs.bud_state", "State / Province"), city: s.tGlobal("urs.bud_city", "City"),
        branchName: s.tGlobal("urs.bud_branch_name", "Branch Name"), branchCode: s.tGlobal("urs.bud_branch_code", "Branch Code"),
        userId: s.tGlobal("urs.bud_user_id", "User ID"), userName: s.tGlobal("urs.bud_user_name", "User Name"), role: s.tGlobal("urs.bud_role", "Role"),
        accessScope: s.tGlobal("urs.bud_scope", "Access Scope"), dateTime: s.tGlobal("urs.bud_datetime", "Date & Time"),
        generatedOn: s.tGlobal("urs.generated_on", "Generated on"), filtersApplied: s.tGlobal("urs.filters_applied", "Filters Applied"),
        page: s.tGlobal("urs.page", "Page"), of: s.tGlobal("urs.of", "of"),
        billNo: s.tGlobal("urs.bill_no", "Bill No"), manualBillNo: s.tGlobal("urs.manual_bill_no", "Manual Bill No"),
        noData: s.tGlobal("urs.no_data", "No data found"), total: s.tGlobal("urs.total", "Total"),
      },
    };
  };

  const exportCsv = () => {
    const head = cols.map((c) => c.label).join(",");
    const lines = rows.map((r) => [r.ledgerCode, `"${r.ledgerName}"`, r.ledgerCurrency, r.countryName || "—", r.cityBranchName || r.countryBranchName || "—", money(r.debitTotal), money(r.creditTotal), money(r.currentBalance), r.isActive ? "Active" : "Inactive"].join(","));
    const blob = new Blob(["﻿" + [head, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `general-ledger-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "General Ledger Report")}
      subtitle={s.t("subtitle", "All ledgers, USD-consolidated")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_ledger", "Ledger Reports"),
          items: [
            { value: "ledger-general", label: s.t("opt_general", "General Ledger Report") },
            { value: "ledger-active", label: s.t("opt_active", "Active Ledgers Only") },
            { value: "ledger-by-country", label: s.t("opt_by_country", "Ledgers by Country") },
          ],
        },
      ]}
      selectedReport={selectedReport}
      onSelectReport={setSelectedReport}
      filters={filters}
      onFiltersChange={setFilters}
      onApplyFilters={() => setApplied(filters)}
      filterOptions={{
        countries, states: [], cities: [], branches: [],
        statuses: [
          { value: "active", label: s.t("st_active", "Active") },
          { value: "inactive", label: s.t("st_inactive", "Inactive") },
        ],
      }}
      showFilters={{ stateId: false, cityId: false, branchId: false }}
      branchUser={{
        country: context.country, state: context.state, city: context.city,
        branchName: context.branchName, branchCode: context.branchCode,
        userId: context.userId.slice(0, 18), userName: context.userName, role: context.role,
        accessScope: context.accessScope, dateTime: new Date().toLocaleString("en-GB"), online: context.online,
      }}
      cards={cards}
      table={{
        title: s.t("table_title", "Ledger Balances"),
        subtitle: s.t("table_sub", "One row per ledger — debit, credit and current balance"),
        columns: cols,
        rows: rows as unknown as Array<Record<string, unknown>>,
        totalCount: rows.length,
      }}
      loading={loading}
      onRefresh={() => void load()}
      onExportPdf={() => openUniversalReport(printInput())}
      onPreviewPdf={() => openUniversalReport(printInput())}
      onPrint={() => openUniversalReport(printInput())}
      onExportCsv={exportCsv}
    />
  );
}
