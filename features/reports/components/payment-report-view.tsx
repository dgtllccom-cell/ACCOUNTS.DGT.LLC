"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wallet, ClipboardList, Globe2, TrendingUp } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet } from "@/lib/api/client";
import type { ReportContext } from "@/lib/reports/resolve-report-context";
import {
  UniversalReportShell,
  type ReportFilterState,
  type ReportMetaOption,
  type ReportCard,
} from "./universal-report-shell";
import {
  openUniversalReport,
  type UrpColumn,
} from "@/lib/reports/universal-report-print";

type PaymentRow = {
  id: string; refNo: string; date: string | null; flow: "supplier_payment" | "customer_receipt";
  country: string; branch: string; party: string; paymentKind: string; currency: string;
  amount: number; status: string; createdBy: string;
};

type PaymentPayload = {
  rows: PaymentRow[]; total: number; page: number; pageSize: number;
  summary: Record<string, number>;
  entriesSummary: Record<string, number>;
  geo: Record<string, number>;
};

const EMPTY_FILTERS: ReportFilterState = {
  dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "",
};

function money(n: number) {
  return (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PaymentReportView({
  context,
  countries,
  branches,
}: {
  context: ReportContext;
  countries: ReportMetaOption[];
  branches: ReportMetaOption[];
}) {
  const s = useErpScreen("payrep");
  const [selectedReport, setSelectedReport] = useState("payment-report");
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY_FILTERS);
  const [data, setData] = useState<PaymentPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (applied.dateFrom) qs.set("fromDate", applied.dateFrom);
      if (applied.dateTo) qs.set("toDate", applied.dateTo);
      if (applied.countryId) qs.set("countryId", applied.countryId);
      if (applied.branchId) qs.set("cityBranchId", applied.branchId);
      if (applied.status) qs.set("status", applied.status);
      const res = await apiGet<PaymentPayload>(`/api/erp/reports/payments?${qs.toString()}`);
      setData(res);
    } catch {
      setData({ rows: [], total: 0, page: 1, pageSize: 25, summary: {}, entriesSummary: {}, geo: {} });
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => { void load(); }, [load]);

  const sum = data?.summary ?? {};
  const ent = data?.entriesSummary ?? {};
  const geo = data?.geo ?? {};

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "financial",
      title: s.t("card_financial", "Payment Financial Summary"),
      subtitle: s.t("card_financial_sub", "Money movement in this scope"),
      icon: <Wallet className="h-4 w-4" />,
      accent: "emerald",
      rows: [
        { label: s.t("f_total_records", "Total Payment Records"), value: sum.totalRecords ?? 0, mono: true },
        { label: s.t("f_total_debit", "Total Debit (Paid Out)"), value: money(sum.totalDebit ?? 0), tone: "negative", mono: true },
        { label: s.t("f_total_credit", "Total Credit (Received)"), value: money(sum.totalCredit ?? 0), tone: "positive", mono: true },
        { label: s.t("f_paid", "Paid Amount"), value: money(sum.paidAmount ?? 0), mono: true },
        { label: s.t("f_received", "Received Amount"), value: money(sum.receivedAmount ?? 0), mono: true },
        { label: s.t("f_pending", "Pending Amount"), value: money(sum.pendingAmount ?? 0), tone: "muted", mono: true },
      ],
      footer: { label: s.t("f_remaining", "Remaining Balance"), value: money(sum.remainingBalance ?? 0), tone: "strong" },
    },
    {
      key: "entries",
      title: s.t("card_entries", "Payment Entries Summary"),
      subtitle: s.t("card_entries_sub", "Status breakdown"),
      icon: <ClipboardList className="h-4 w-4" />,
      accent: "purple",
      rows: [
        { label: s.t("e_total", "Total Entries"), value: ent.totalEntries ?? 0, mono: true, tone: "strong" },
        { label: s.t("e_posted", "Posted / Paid"), value: ent.posted ?? 0, tone: "positive", mono: true },
        { label: s.t("e_pending", "Pending"), value: ent.pending ?? 0, mono: true },
        { label: s.t("e_partial", "Partial"), value: ent.partial ?? 0, mono: true },
        { label: s.t("e_draft", "Draft"), value: ent.draft ?? 0, mono: true },
        { label: s.t("e_cancelled", "Cancelled"), value: ent.cancelled ?? 0, tone: "negative", mono: true },
      ],
      footer: { label: s.t("e_supplier_customer", "Supplier / Customer"), value: `${ent.supplierPayments ?? 0} / ${ent.customerReceipts ?? 0}` },
    },
    {
      key: "geo",
      title: s.t("card_geo", "Country / Branch Payment Report"),
      subtitle: s.t("card_geo_sub", "Coverage in this scope"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("g_countries", "Countries"), value: geo.countries ?? 0, mono: true },
        { label: s.t("g_main_branches", "Main Branches"), value: geo.countryBranches ?? 0, mono: true },
        { label: s.t("g_city_branches", "City Branches"), value: geo.cityBranches ?? 0, mono: true },
        { label: s.t("g_users", "Users"), value: geo.users ?? 0, mono: true },
        { label: s.t("g_parties", "Parties"), value: geo.parties ?? 0, mono: true },
      ],
      footer: { label: s.t("g_scoped_total", "Scoped Payment Total"), value: money(geo.scopedPaymentTotal ?? 0), tone: "strong" },
    },
  ], [s, sum, ent, geo]);

  const statusLabel = (st: string) => {
    const map: Record<string, string> = {
      posted: s.t("st_posted", "Posted"), cancelled: s.t("st_cancelled", "Cancelled"),
      pending: s.t("st_pending", "Pending"), partial: s.t("st_partial", "Partial"), draft: s.t("st_draft", "Draft"),
    };
    return map[st] ?? st;
  };
  const flowLabel = (f: string) => f === "supplier_payment" ? s.t("flow_supplier", "Supplier Payment") : s.t("flow_customer", "Customer Receipt");

  const shellColumns = [
    { key: "refNo", label: s.t("col_ref", "Payment / Ref No"), align: "start" as const },
    { key: "date", label: s.t("col_date", "Date"), align: "start" as const, render: (r: Record<string, unknown>) => r.date ? new Date(String(r.date)).toLocaleDateString("en-GB") : "—" },
    { key: "country", label: s.t("col_country", "Country"), align: "start" as const },
    { key: "branch", label: s.t("col_branch", "Branch"), align: "start" as const },
    { key: "party", label: s.t("col_party", "Party"), align: "start" as const },
    { key: "flow", label: s.t("col_type", "Payment Type"), align: "start" as const, render: (r: Record<string, unknown>) => flowLabel(String(r.flow)) },
    { key: "currency", label: s.t("col_currency", "Currency"), align: "center" as const },
    { key: "amount", label: s.t("col_amount", "Amount"), align: "end" as const, render: (r: Record<string, unknown>) => money(Number(r.amount)) },
    { key: "status", label: s.t("col_status", "Status"), align: "center" as const, render: (r: Record<string, unknown>) => statusLabel(String(r.status)) },
    { key: "createdBy", label: s.t("col_created_by", "Created By"), align: "start" as const },
  ];

  const filterOptions = {
    countries,
    states: [] as ReportMetaOption[],
    cities: [] as ReportMetaOption[],
    branches,
    statuses: [
      { value: "posted", label: s.t("st_posted", "Posted") },
      { value: "pending", label: s.t("st_pending", "Pending") },
      { value: "partial", label: s.t("st_partial", "Partial") },
      { value: "cancelled", label: s.t("st_cancelled", "Cancelled") },
    ],
  };

  // ── PDF / print — feed the SAME data to the shared A4 engine ──
  const buildPrintInput = () => {
    const pdfCols: UrpColumn[] = [
      { key: "refNo", label: s.t("col_ref", "Payment / Ref No") },
      { key: "date", label: s.t("col_date", "Date"), format: "date" },
      { key: "country", label: s.t("col_country", "Country") },
      { key: "branch", label: s.t("col_branch", "Branch") },
      { key: "party", label: s.t("col_party", "Party") },
      { key: "flowLabel", label: s.t("col_type", "Payment Type") },
      { key: "currency", label: s.t("col_currency", "Currency"), align: "center" },
      { key: "amount", label: s.t("col_amount", "Amount"), align: "end", format: "currency" },
      { key: "statusLabel", label: s.t("col_status", "Status"), align: "center" },
      { key: "createdBy", label: s.t("col_created_by", "Created By") },
    ];
    const rows = (data?.rows ?? []).map((r) => ({
      ...r,
      date: r.date ? new Date(r.date).toLocaleDateString("en-GB") : "",
      flowLabel: flowLabel(r.flow),
      statusLabel: statusLabel(r.status),
    }));
    const appliedFilters = [
      applied.dateFrom || applied.dateTo ? { label: s.tGlobal("urs.f_date_range", "Date Range"), value: `${applied.dateFrom || "…"} → ${applied.dateTo || "…"}` } : null,
      applied.countryId ? { label: s.tGlobal("urs.f_country", "Country"), value: countries.find((c) => c.id === applied.countryId)?.name ?? applied.countryId } : null,
      applied.branchId ? { label: s.tGlobal("urs.f_branch", "Branch"), value: branches.find((b) => b.id === applied.branchId)?.name ?? applied.branchId } : null,
      applied.status ? { label: s.tGlobal("urs.f_status", "Status"), value: statusLabel(applied.status) } : null,
    ].filter(Boolean) as Array<{ label: string; value: string }>;

    return {
      lang: s.lang,
      title: s.t("title", "Payment Report"),
      subtitle: s.t("subtitle", "Track. Reconcile. Keep Business Moving."),
      fileSlug: "payment-report",
      branchUser: {
        country: context.country, state: context.state, city: context.city,
        branchName: context.branchName, branchCode: context.branchCode,
        userId: context.userId, userName: context.userName, role: context.role,
        accessScope: context.accessScope, dateTime: new Date().toLocaleString("en-GB"),
        online: context.online,
      },
      cards: [
        { title: cards[0].title, subtitle: cards[0].subtitle, rows: cards[0].rows.map((r) => ({ ...r })), footer: cards[0].footer },
        { title: cards[1].title, subtitle: cards[1].subtitle, rows: cards[1].rows.map((r) => ({ ...r })), footer: cards[1].footer },
        { title: cards[2].title, subtitle: cards[2].subtitle, rows: cards[2].rows.map((r) => ({ ...r })), footer: cards[2].footer },
      ],
      appliedFilters,
      table: {
        title: s.t("table_title", "Payment Entries"),
        columns: pdfCols,
        rows,
        totals: { amount: (data?.rows ?? []).reduce((a, r) => a + (Number(r.amount) || 0), 0) },
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
    const header = shellColumns.map((c) => c.label).join(",");
    const lines = (data?.rows ?? []).map((r) =>
      [r.refNo, r.date ? new Date(r.date).toLocaleDateString("en-GB") : "", r.country, r.branch, `"${r.party}"`, flowLabel(r.flow), r.currency, money(r.amount), statusLabel(r.status), `"${r.createdBy}"`].join(","),
    );
    const blob = new Blob(["﻿" + [header, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payment-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "Payment Report")}
      subtitle={s.t("subtitle", "Track. Reconcile. Keep Business Moving.")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_payment", "Payment Reports"),
          items: [
            { value: "payment-report", label: s.t("opt_payment_report", "Payment Report") },
            { value: "payment-entries", label: s.t("opt_payment_entries", "Payment Entries") },
            { value: "payment-financial", label: s.t("opt_payment_financial", "Payment Financial Summary") },
          ],
        },
        {
          label: s.t("grp_analytics", "Analytics Reports"),
          items: [
            { value: "country-branch", label: s.t("opt_country_branch", "Country / Branch Report") },
            { value: "paid", label: s.t("opt_paid", "Paid Payments") },
            { value: "pending", label: s.t("opt_pending", "Pending Payments") },
            { value: "user-wise", label: s.t("opt_user_wise", "User-wise Payment Report") },
          ],
        },
      ]}
      selectedReport={selectedReport}
      onSelectReport={setSelectedReport}
      filters={filters}
      onFiltersChange={setFilters}
      onApplyFilters={() => { setPage(1); setApplied(filters); }}
      filterOptions={filterOptions}
      showFilters={{ stateId: false, cityId: false }}
      branchUser={{
        country: context.country, state: context.state, city: context.city,
        branchName: context.branchName, branchCode: context.branchCode,
        userId: context.userId.slice(0, 18), userName: context.userName, role: context.role,
        accessScope: context.accessScope, dateTime: new Date().toLocaleString("en-GB"),
        online: context.online,
      }}
      cards={cards}
      table={{
        title: s.t("table_title", "Payment Entries"),
        subtitle: s.t("table_sub", "Every supplier payment and customer receipt in scope"),
        columns: shellColumns,
        rows: (data?.rows ?? []) as unknown as Array<Record<string, unknown>>,
        totalCount: data?.total ?? 0,
      }}
      loading={loading}
      onRefresh={() => void load()}
      onExportPdf={() => openUniversalReport(buildPrintInput())}
      onPreviewPdf={() => openUniversalReport(buildPrintInput())}
      onPrint={() => openUniversalReport(buildPrintInput())}
      onExportCsv={exportCsv}
    />
  );
}
