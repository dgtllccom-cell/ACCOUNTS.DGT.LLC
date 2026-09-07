"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, ClipboardList, Globe2 } from "lucide-react";
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

type CountryRow = {
  id: string; name: string; iso2: string; currencyCode: string; isActive: boolean;
  mainBranches: number; cityBranches: number; totalBranches: number; users: number;
  totalCredit: number; totalDebit: number; netBalance: number;
};
type Overview = {
  rows: CountryRow[];
  summary: Record<string, number>;
  txns: Record<string, number>;
  coverage: Record<string, number>;
};

const EMPTY: ReportFilterState = { dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "" };
const money = (n: number) => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function SuperAdminReportView({
  context,
  countries,
}: {
  context: ReportContext;
  countries: ReportMetaOption[];
}) {
  const s = useErpScreen("sarep");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState("super-admin-overview");
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (applied.countryId) qs.set("countryId", applied.countryId);
      if (applied.dateFrom) qs.set("fromDate", applied.dateFrom);
      if (applied.dateTo) qs.set("toDate", applied.dateTo);
      const res = await apiGet<Overview>(`/api/erp/reports/super-admin/overview?${qs.toString()}`);
      setData(res);
    } catch {
      setData({ rows: [], summary: {}, txns: {}, coverage: {} });
    } finally {
      setLoading(false);
    }
  }, [applied]);
  useEffect(() => { void load(); }, [load]);

  const rows = data?.rows ?? [];
  const sm = data?.summary ?? {};
  const tx = data?.txns ?? {};
  const cov = data?.coverage ?? {};

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "financial",
      title: s.t("card_financial", "Global Financial Summary"),
      subtitle: s.t("card_financial_sub", "Posted roznamcha, all countries (USD)"),
      icon: <BarChart3 className="h-4 w-4" />,
      accent: "emerald",
      rows: [
        { label: s.t("f_countries", "Countries"), value: sm.totalCountries ?? 0, mono: true },
        { label: s.t("f_branches", "Total Branches"), value: sm.totalBranches ?? 0, mono: true },
        { label: s.t("f_users", "Total Users"), value: sm.totalUsers ?? 0, mono: true },
        { label: s.t("f_credit", "Total Credit (USD)"), value: money(sm.totalCredit ?? 0), tone: "positive", mono: true },
        { label: s.t("f_debit", "Total Debit (USD)"), value: money(sm.totalDebit ?? 0), tone: "negative", mono: true },
      ],
      footer: { label: s.t("f_net", "Net Balance (USD)"), value: money(sm.netBalance ?? 0), tone: "strong" },
    },
    {
      key: "txns",
      title: s.t("card_txns", "Transactions Summary"),
      subtitle: s.t("card_txns_sub", "Documents across all countries"),
      icon: <ClipboardList className="h-4 w-4" />,
      accent: "purple",
      rows: [
        { label: s.t("t_po", "Purchase Orders"), value: tx.purchaseOrders ?? 0, mono: true },
        { label: s.t("t_so", "Sales Orders"), value: tx.salesOrders ?? 0, mono: true },
        { label: s.t("t_roz", "Roznamcha (Posted)"), value: tx.roznamchaPosted ?? 0, tone: "positive", mono: true },
        { label: s.t("t_roz_x", "Roznamcha (Cancelled)"), value: tx.roznamchaCancelled ?? 0, tone: "negative", mono: true },
        { label: s.t("t_pay", "Payment Entries"), value: tx.paymentEntries ?? 0, mono: true },
      ],
      footer: { label: s.t("t_bill_reg", "Bill-Expense Register"), value: tx.billRegister ?? 0 },
    },
    {
      key: "coverage",
      title: s.t("card_coverage", "All Countries Coverage"),
      subtitle: s.t("card_coverage_sub", "Global operations footprint"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("c_active", "Active Countries"), value: cov.activeCountries ?? 0, mono: true, tone: "strong" },
        { label: s.t("c_main", "Main Branches"), value: cov.mainBranches ?? 0, mono: true },
        { label: s.t("c_city", "City Branches"), value: cov.cityBranches ?? 0, mono: true },
        { label: s.t("c_currencies", "Currencies"), value: cov.currencies ?? 0, mono: true },
      ],
      footer: { label: s.t("c_total_branches", "Total Branches"), value: (cov.mainBranches ?? 0) + (cov.cityBranches ?? 0), tone: "strong" },
    },
  ], [s, sm, tx, cov]);

  const cols = [
    { key: "name", label: s.t("col_country", "Country"), align: "start" as const,
      render: (r: Record<string, unknown>) => `${r.iso2 ? `[${r.iso2}] ` : ""}${r.name}` },
    { key: "totalBranches", label: s.t("col_branches", "Total Branches"), align: "center" as const },
    { key: "cityBranches", label: s.t("col_active_branches", "City Branches"), align: "center" as const },
    { key: "users", label: s.t("col_users", "Total Users"), align: "center" as const },
    { key: "totalCredit", label: s.t("col_credit", "Total Credit (USD)"), align: "end" as const, render: (r: Record<string, unknown>) => money(Number(r.totalCredit)) },
    { key: "totalDebit", label: s.t("col_debit", "Total Debit (USD)"), align: "end" as const, render: (r: Record<string, unknown>) => money(Number(r.totalDebit)) },
    { key: "netBalance", label: s.t("col_net", "Net Balance (USD)"), align: "end" as const, render: (r: Record<string, unknown>) => money(Number(r.netBalance)) },
    { key: "isActive", label: s.t("col_status", "Status"), align: "center" as const,
      render: (r: Record<string, unknown>) => (r.isActive ? s.t("st_active", "Active") : s.t("st_inactive", "Inactive")) },
  ];

  const footerRow = useMemo(() => ({
    name: s.t("total_row", "All Countries"),
    iso2: "",
    totalBranches: sm.totalBranches ?? 0,
    cityBranches: cov.cityBranches ?? 0,
    users: sm.totalUsers ?? 0,
    totalCredit: sm.totalCredit ?? 0,
    totalDebit: sm.totalDebit ?? 0,
    netBalance: sm.netBalance ?? 0,
    isActive: true,
  }), [s, sm, cov]);

  const printInput = () => {
    const pdfCols: UrpColumn[] = [
      { key: "countryLabel", label: s.t("col_country", "Country") },
      { key: "totalBranches", label: s.t("col_branches", "Total Branches"), align: "center", format: "number" },
      { key: "cityBranches", label: s.t("col_active_branches", "City Branches"), align: "center", format: "number" },
      { key: "users", label: s.t("col_users", "Total Users"), align: "center", format: "number" },
      { key: "totalCredit", label: s.t("col_credit", "Total Credit (USD)"), align: "end", format: "currency" },
      { key: "totalDebit", label: s.t("col_debit", "Total Debit (USD)"), align: "end", format: "currency" },
      { key: "netBalance", label: s.t("col_net", "Net Balance (USD)"), align: "end", format: "currency" },
      { key: "statusLabel", label: s.t("col_status", "Status"), align: "center" },
    ];
    const prows = rows.map((r) => ({
      ...r,
      countryLabel: `${r.iso2 ? `[${r.iso2}] ` : ""}${r.name}`,
      statusLabel: r.isActive ? s.t("st_active", "Active") : s.t("st_inactive", "Inactive"),
    }));
    return {
      lang: s.lang,
      title: s.t("title", "Super Admin Reports"),
      subtitle: s.t("subtitle", "Global visibility. Complete control."),
      fileSlug: "super-admin-reports",
      orientation: "landscape" as const,
      branchUser: {
        country: context.country, state: context.state, city: context.city,
        branchName: context.branchName, branchCode: context.branchCode,
        userId: context.userId, userName: context.userName, role: context.role,
        accessScope: context.accessScope, dateTime: new Date().toLocaleString("en-GB"), online: context.online,
      },
      cards: cards.map((c) => ({ title: c.title, subtitle: c.subtitle, rows: c.rows.map((r) => ({ ...r })), footer: c.footer })),
      appliedFilters: [
        applied.countryId ? { label: s.tGlobal("urs.f_country", "Country"), value: countries.find((c) => c.id === applied.countryId)?.name ?? applied.countryId } : null,
        applied.dateFrom || applied.dateTo ? { label: s.tGlobal("urs.f_date_range", "Date Range"), value: `${applied.dateFrom || "…"} → ${applied.dateTo || "…"}` } : null,
      ].filter(Boolean) as Array<{ label: string; value: string }>,
      table: {
        title: s.t("table_title", "Country Performance"),
        columns: pdfCols,
        rows: prows,
        totals: {
          totalBranches: sm.totalBranches ?? 0,
          users: sm.totalUsers ?? 0,
          totalCredit: sm.totalCredit ?? 0,
          totalDebit: sm.totalDebit ?? 0,
          netBalance: sm.netBalance ?? 0,
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
    const head = ["Country", "ISO", "Total Branches", "City Branches", "Users", "Credit USD", "Debit USD", "Net USD", "Status"].join(",");
    const lines = rows.map((r) => [`"${r.name}"`, r.iso2, r.totalBranches, r.cityBranches, r.users, r.totalCredit.toFixed(2), r.totalDebit.toFixed(2), r.netBalance.toFixed(2), r.isActive ? "Active" : "Inactive"].join(","));
    const blob = new Blob(["﻿" + [head, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `super-admin-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "Super Admin Reports")}
      subtitle={s.t("subtitle", "Global visibility. Complete control.")}
      locationLine={s.t("location", "All countries · all branches")}
      bannerImage={context.bannerImage}
      scopeBadge={s.t("scope", "Report Scope: Global")}
      reportGroups={[
        {
          label: s.t("grp_global", "Global Reports"),
          items: [
            { value: "super-admin-overview", label: s.t("opt_overview", "Super Admin Overview") },
            { value: "country-performance", label: s.t("opt_country_perf", "Country Performance") },
            { value: "global-financial", label: s.t("opt_global_financial", "Global Financial Summary") },
          ],
        },
      ]}
      selectedReport={selectedReport}
      onSelectReport={setSelectedReport}
      filters={filters}
      onFiltersChange={setFilters}
      onApplyFilters={() => setApplied(filters)}
      filterOptions={{ countries, states: [], cities: [], branches: [], statuses: [] }}
      showFilters={{ stateId: false, cityId: false, branchId: false, status: false }}
      branchUser={{
        country: context.country, state: context.state, city: context.city,
        branchName: context.branchName, branchCode: context.branchCode,
        userId: context.userId.slice(0, 18), userName: context.userName, role: context.role,
        accessScope: context.accessScope, dateTime: new Date().toLocaleString("en-GB"), online: context.online,
      }}
      cards={cards}
      table={{
        title: s.t("table_title", "Country Performance"),
        subtitle: s.t("table_sub", "Country-wise branch, user and financial performance"),
        columns: cols,
        rows: rows as unknown as Array<Record<string, unknown>>,
        totalCount: rows.length,
        footerRow: rows.length ? (footerRow as unknown as Record<string, unknown>) : undefined,
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
