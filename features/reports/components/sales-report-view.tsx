"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TrendingUp, ClipboardList, Globe2 } from "lucide-react";
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

type SalesRow = {
  id: string; displayBillNumber: string | null; manualBillNumber: string | null;
  salesDate: string | null; customerName: string | null; productName: string | null;
  quantity: number | null; unit: string | null; salesRate: number | null;
  salesAmount: number | null; finalAmount: number | null; currency: string | null;
  status: string | null; paymentStatus: string | null;
  paid_amount: number; remaining_amount: number;
  countryName?: string | null; branchName?: string | null;
};
type Payload = { reports: SalesRow[]; summary: Record<string, any> };

const EMPTY: ReportFilterState = { dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "" };
const money = (n: unknown) => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = (n: unknown) => (Number(n) || 0).toLocaleString("en-US");

export function SalesReportView({
  context, countries,
}: { context: ReportContext; countries: ReportMetaOption[] }) {
  const s = useErpScreen("salrep");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState("sales-register");
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (applied.dateFrom) qs.set("fromDate", applied.dateFrom);
      if (applied.dateTo) qs.set("toDate", applied.dateTo);
      if (applied.countryId) qs.set("countryId", applied.countryId);
      if (applied.status) qs.set("status", applied.status);
      const res = await apiGet<Payload>(`/api/erp/sales/booking-journal-report?${qs.toString()}`);
      setData(res);
    } catch {
      setData({ reports: [], summary: {} });
    } finally {
      setLoading(false);
    }
  }, [applied]);
  useEffect(() => { void load(); }, [load]);

  const sm = data?.summary ?? {};
  const rows = useMemo(() => {
    let r = data?.reports ?? [];
    if (applied.status) r = r.filter((x) => new RegExp(applied.status, "i").test(String(x.status ?? "")));
    return r;
  }, [data, applied.status]);

  const totals = useMemo(() => {
    const sale = rows.reduce((a, r) => a + (Number(r.salesAmount) || 0), 0);
    const paid = rows.reduce((a, r) => a + (Number(r.paid_amount) || 0), 0);
    const remaining = rows.reduce((a, r) => a + (Number(r.remaining_amount) || 0), 0);
    const pendingCount = rows.filter((r) => (Number(r.remaining_amount) || 0) > 0).length;
    return { sale, paid, remaining, pendingCount };
  }, [rows]);
  const byStatus = (re: RegExp) => rows.filter((r) => re.test(String(r.status ?? ""))).length;

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "financial",
      title: s.t("card_financial", "Sales Financial Summary"),
      subtitle: s.t("card_financial_sub", "Booking + payment totals in scope"),
      icon: <TrendingUp className="h-4 w-4" />,
      accent: "emerald",
      rows: [
        { label: s.t("f_total", "Total Sales Bookings"), value: sm.total ?? rows.length, mono: true, tone: "strong" },
        { label: s.t("f_amount", "Total Sales Amount"), value: money(totals.sale), tone: "positive", mono: true },
        { label: s.t("f_qty", "Total Quantity"), value: int(sm.totalQuantity), mono: true },
        { label: s.t("f_paid", "Paid Amount"), value: money(totals.paid), mono: true },
        { label: s.t("f_pending", "Pending Bookings"), value: totals.pendingCount, tone: "muted", mono: true },
      ],
      footer: { label: s.t("f_remaining", "Remaining Amount"), value: money(totals.remaining), tone: "strong" },
    },
    {
      key: "status",
      title: s.t("card_status", "Sales Status Summary"),
      subtitle: s.t("card_status_sub", "Live status breakdown"),
      icon: <ClipboardList className="h-4 w-4" />,
      accent: "purple",
      rows: [
        { label: s.t("t_draft", "Draft"), value: byStatus(/draft/i), tone: "muted", mono: true },
        { label: s.t("t_confirmed", "Confirmed / Booked"), value: byStatus(/confirm|book/i), mono: true },
        { label: s.t("t_transferred", "Transferred"), value: byStatus(/transfer/i), mono: true },
        { label: s.t("t_completed", "Completed / Delivered"), value: byStatus(/complet|deliver/i), tone: "positive", mono: true },
        { label: s.t("t_cancelled", "Cancelled"), value: byStatus(/cancel/i), tone: "negative", mono: true },
      ],
      footer: { label: s.t("t_fully_paid", "Fully Paid"), value: rows.filter((r) => (Number(r.remaining_amount) || 0) <= 0 && (Number(r.paid_amount) || 0) > 0).length },
    },
    {
      key: "coverage",
      title: s.t("card_coverage", "Customer / Branch Coverage"),
      subtitle: s.t("card_coverage_sub", "Operating footprint"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("c_customers", "Customers"), value: new Set(rows.map((r) => r.customerName).filter((x) => x && x !== "-")).size, mono: true },
        { label: s.t("c_countries", "Countries"), value: new Set(rows.map((r) => r.countryName).filter((x) => x && x !== "-")).size, mono: true },
        { label: s.t("c_branches", "Branches"), value: new Set(rows.map((r) => r.branchName).filter((x) => x && x !== "-")).size, mono: true },
        { label: s.t("c_currencies", "Currencies"), value: new Set(rows.map((r) => r.currency).filter(Boolean)).size, mono: true },
      ],
      footer: { label: s.t("c_containers", "Total Containers"), value: sm.totalContainers ?? 0 },
    },
  ], [s, sm, rows, totals]);

  const cols = [
    { key: "bill", label: s.t("col_bill", "Bill No"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.displayBillNumber || "—") },
    { key: "manualBillNumber", label: s.t("col_manual", "Manual Bill No"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.manualBillNumber || "—") },
    { key: "salesDate", label: s.t("col_date", "Date"), align: "start" as const, render: (r: Record<string, unknown>) => r.salesDate ? new Date(String(r.salesDate)).toLocaleDateString("en-GB") : "—" },
    { key: "customerName", label: s.t("col_customer", "Customer"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.customerName || "—") },
    { key: "productName", label: s.t("col_product", "Product"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.productName || "—") },
    { key: "quantity", label: s.t("col_qty", "Qty"), align: "end" as const, render: (r: Record<string, unknown>) => `${int(r.quantity)} ${r.unit || ""}`.trim() },
    { key: "salesAmount", label: s.t("col_amount", "Sales Amount"), align: "end" as const, render: (r: Record<string, unknown>) => money(r.salesAmount) },
    { key: "paid_amount", label: s.t("col_paid", "Paid"), align: "end" as const, render: (r: Record<string, unknown>) => money(r.paid_amount) },
    { key: "remaining_amount", label: s.t("col_remaining", "Remaining"), align: "end" as const, render: (r: Record<string, unknown>) => money(r.remaining_amount) },
    { key: "status", label: s.t("col_status", "Status"), align: "center" as const, render: (r: Record<string, unknown>) => String(r.status || "—") },
  ];

  const printInput = () => {
    const pdfCols: UrpColumn[] = [
      { key: "bill", label: s.t("col_bill", "Bill No") },
      { key: "manual", label: s.t("col_manual", "Manual Bill No") },
      { key: "date", label: s.t("col_date", "Date"), format: "date" },
      { key: "customer", label: s.t("col_customer", "Customer") },
      { key: "product", label: s.t("col_product", "Product") },
      { key: "qty", label: s.t("col_qty", "Qty"), align: "end" },
      { key: "amount", label: s.t("col_amount", "Sales Amount"), align: "end", format: "currency" },
      { key: "paid", label: s.t("col_paid", "Paid"), align: "end", format: "currency" },
      { key: "remaining", label: s.t("col_remaining", "Remaining"), align: "end", format: "currency" },
      { key: "status", label: s.t("col_status", "Status"), align: "center" },
    ];
    const prows = rows.map((r) => ({
      bill: r.displayBillNumber || "—",
      manual: r.manualBillNumber || "—",
      date: r.salesDate ? new Date(r.salesDate).toLocaleDateString("en-GB") : "",
      customer: r.customerName || "—",
      product: r.productName || "—",
      qty: `${int(r.quantity)} ${r.unit || ""}`.trim(),
      amount: Number(r.salesAmount) || 0,
      paid: Number(r.paid_amount) || 0,
      remaining: Number(r.remaining_amount) || 0,
      status: r.status || "—",
    }));
    return {
      lang: s.lang,
      title: s.t("title", "Sales Report"),
      subtitle: s.t("subtitle", "All sales bookings — amounts, customers, payment"),
      fileSlug: "sales-report",
      orientation: "landscape" as const,
      branchUser: {
        country: context.country, state: context.state, city: context.city,
        branchName: context.branchName, branchCode: context.branchCode,
        userId: context.userId, userName: context.userName, role: context.role,
        accessScope: context.accessScope, dateTime: new Date().toLocaleString("en-GB"), online: context.online,
      },
      cards: cards.map((c) => ({ title: c.title, subtitle: c.subtitle, rows: c.rows.map((r) => ({ ...r })), footer: c.footer })),
      appliedFilters: [
        applied.dateFrom || applied.dateTo ? { label: s.tGlobal("urs.f_date_range", "Date Range"), value: `${applied.dateFrom || "…"} → ${applied.dateTo || "…"}` } : null,
        applied.countryId ? { label: s.tGlobal("urs.f_country", "Country"), value: countries.find((c) => c.id === applied.countryId)?.name ?? applied.countryId } : null,
      ].filter(Boolean) as Array<{ label: string; value: string }>,
      table: {
        title: s.t("table_title", "Sales Bookings"),
        columns: pdfCols,
        rows: prows,
        totals: {
          amount: prows.reduce((a, r) => a + r.amount, 0),
          paid: prows.reduce((a, r) => a + r.paid, 0),
          remaining: prows.reduce((a, r) => a + r.remaining, 0),
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
    const lines = rows.map((r) => [r.displayBillNumber || "—", r.manualBillNumber || "—", r.salesDate ? new Date(r.salesDate).toLocaleDateString("en-GB") : "", `"${r.customerName || "—"}"`, `"${r.productName || "—"}"`, int(r.quantity), money(r.salesAmount), money(r.paid_amount), money(r.remaining_amount), r.status || "—"].join(","));
    const blob = new Blob(["﻿" + [head, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sales-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "Sales Report")}
      subtitle={s.t("subtitle", "All sales bookings — amounts, customers, payment")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_sales", "Sales Reports"),
          items: [
            { value: "sales-register", label: s.t("opt_register", "Sales Register") },
            { value: "sales-booking", label: s.t("opt_booking", "Sales Booking Journal") },
            { value: "sales-outstanding", label: s.t("opt_outstanding", "Outstanding Sales") },
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
          { value: "draft", label: s.t("t_draft", "Draft") },
          { value: "confirm", label: s.t("t_confirmed", "Confirmed / Booked") },
          { value: "transfer", label: s.t("t_transferred", "Transferred") },
          { value: "complet", label: s.t("t_completed", "Completed / Delivered") },
          { value: "cancel", label: s.t("t_cancelled", "Cancelled") },
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
        title: s.t("table_title", "Sales Bookings"),
        subtitle: s.t("table_sub", "One row per sales booking — amount, paid, remaining"),
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
