"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingBag, ClipboardList, Globe2 } from "lucide-react";
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

type PurchaseRow = {
  id: string; purchase_order_no: string | null; displayBillNumber: string | null;
  manualBillNumber: string | null; purchaseDate: string | null;
  supplierName: string | null; productName: string | null;
  quantity: number | null; unit: string | null; purchaseRate: number | null;
  purchaseAmount: number | null; finalAmount: number | null; containerCount: number | null;
  status?: string | null; countryName?: string | null; branchName?: string | null;
};
type Payload = { reports: PurchaseRow[]; summary: Record<string, any> };

const EMPTY: ReportFilterState = { dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "" };
const money = (n: unknown) => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = (n: unknown) => (Number(n) || 0).toLocaleString("en-US");

export function PurchaseRegisterReportView({
  context, countries,
}: { context: ReportContext; countries: ReportMetaOption[] }) {
  const s = useErpScreen("purrep");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState("purchase-register");
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (applied.dateFrom) qs.set("fromDate", applied.dateFrom);
      if (applied.dateTo) qs.set("toDate", applied.dateTo);
      if (applied.countryId) qs.set("countryId", applied.countryId);
      const res = await apiGet<Payload>(`/api/erp/purchases/booking-journal-report?${qs.toString()}`);
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

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "financial",
      title: s.t("card_financial", "Purchase Financial Summary"),
      subtitle: s.t("card_financial_sub", "Booking totals in this scope"),
      icon: <ShoppingBag className="h-4 w-4" />,
      accent: "emerald",
      rows: [
        { label: s.t("f_total", "Total Bookings"), value: sm.total ?? rows.length, mono: true, tone: "strong" },
        { label: s.t("f_amount", "Total Purchase Amount"), value: money(sm.totalAmount), tone: "negative", mono: true },
        { label: s.t("f_qty", "Total Quantity"), value: int(sm.totalQuantity), mono: true },
        { label: s.t("f_accepted", "Accepted Amount"), value: money(sm.acceptedAmount), mono: true },
        { label: s.t("f_transferred", "Transferred Amount"), value: money(sm.transferredAmount), mono: true },
        { label: s.t("f_completed", "Completed Amount"), value: money(sm.completedAmount), tone: "positive", mono: true },
      ],
      footer: {
        label: s.t("f_remaining", "Remaining Amount"),
        value: money((Number(sm.totalAmount) || 0) - (Number(sm.completedAmount) || 0)),
        tone: "strong",
      },
    },
    {
      key: "status",
      title: s.t("card_status", "Booking Status Summary"),
      subtitle: s.t("card_status_sub", "Live status breakdown"),
      icon: <ClipboardList className="h-4 w-4" />,
      accent: "purple",
      rows: [
        { label: s.t("t_draft", "Draft"), value: sm.draft ?? 0, tone: "muted", mono: true },
        { label: s.t("t_accepted", "Accepted"), value: sm.accepted ?? 0, mono: true },
        { label: s.t("t_transferred", "Transferred"), value: sm.transferred ?? 0, mono: true },
        { label: s.t("t_completed", "Completed"), value: sm.completed ?? 0, tone: "positive", mono: true },
        { label: s.t("t_cancelled", "Cancelled"), value: sm.cancelled ?? 0, tone: "negative", mono: true },
      ],
      footer: { label: s.t("t_containers", "Total Containers"), value: sm.totalContainers ?? 0 },
    },
    {
      key: "coverage",
      title: s.t("card_coverage", "Branch & Currency Coverage"),
      subtitle: s.t("card_coverage_sub", "Operating footprint"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("c_branches", "Total Branches"), value: sm.totalBranches ?? 0, mono: true },
        { label: s.t("c_active", "Active Branches"), value: sm.activeBranches ?? 0, tone: "positive", mono: true },
        { label: s.t("c_currency", "Currency"), value: sm.quickInfo?.currency ?? "—" },
        { label: s.t("c_rate", "Exchange Rate"), value: sm.quickInfo?.exchangeRate ?? "—", mono: true },
        { label: s.t("c_fy", "Financial Year"), value: sm.quickInfo?.financialYear ?? "—" },
      ],
      footer: { label: s.t("c_company", "Company"), value: sm.quickInfo?.company ?? "—" },
    },
  ], [s, sm, rows]);

  const cols = [
    { key: "bill", label: s.t("col_bill", "Bill No"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.displayBillNumber || r.purchase_order_no || "—") },
    { key: "manualBillNumber", label: s.t("col_manual", "Manual Bill No"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.manualBillNumber || "—") },
    { key: "purchaseDate", label: s.t("col_date", "Date"), align: "start" as const, render: (r: Record<string, unknown>) => r.purchaseDate ? new Date(String(r.purchaseDate)).toLocaleDateString("en-GB") : "—" },
    { key: "supplierName", label: s.t("col_supplier", "Supplier"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.supplierName || "—") },
    { key: "productName", label: s.t("col_product", "Product"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.productName || "—") },
    { key: "quantity", label: s.t("col_qty", "Qty"), align: "end" as const, render: (r: Record<string, unknown>) => `${int(r.quantity)} ${r.unit || ""}`.trim() },
    { key: "purchaseRate", label: s.t("col_rate", "Rate"), align: "end" as const, render: (r: Record<string, unknown>) => money(r.purchaseRate) },
    { key: "purchaseAmount", label: s.t("col_amount", "Amount"), align: "end" as const, render: (r: Record<string, unknown>) => money(r.purchaseAmount) },
    { key: "finalAmount", label: s.t("col_final", "Final Amount"), align: "end" as const, render: (r: Record<string, unknown>) => money(r.finalAmount ?? r.purchaseAmount) },
    { key: "status", label: s.t("col_status", "Status"), align: "center" as const, render: (r: Record<string, unknown>) => String(r.status || "—") },
  ];

  const printInput = () => {
    const pdfCols: UrpColumn[] = [
      { key: "bill", label: s.t("col_bill", "Bill No") },
      { key: "manual", label: s.t("col_manual", "Manual Bill No") },
      { key: "date", label: s.t("col_date", "Date"), format: "date" },
      { key: "supplier", label: s.t("col_supplier", "Supplier") },
      { key: "product", label: s.t("col_product", "Product") },
      { key: "qty", label: s.t("col_qty", "Qty"), align: "end" },
      { key: "rate", label: s.t("col_rate", "Rate"), align: "end", format: "currency" },
      { key: "amount", label: s.t("col_amount", "Amount"), align: "end", format: "currency" },
      { key: "finalAmount", label: s.t("col_final", "Final Amount"), align: "end", format: "currency" },
      { key: "status", label: s.t("col_status", "Status"), align: "center" },
    ];
    const prows = rows.map((r) => ({
      bill: r.displayBillNumber || r.purchase_order_no || "—",
      manual: r.manualBillNumber || "—",
      date: r.purchaseDate ? new Date(r.purchaseDate).toLocaleDateString("en-GB") : "",
      supplier: r.supplierName || "—",
      product: r.productName || "—",
      qty: `${int(r.quantity)} ${r.unit || ""}`.trim(),
      rate: Number(r.purchaseRate) || 0,
      amount: Number(r.purchaseAmount) || 0,
      finalAmount: Number(r.finalAmount ?? r.purchaseAmount) || 0,
      status: r.status || "—",
    }));
    return {
      lang: s.lang,
      title: s.t("title", "Purchase Register"),
      subtitle: s.t("subtitle", "All purchase bookings — amounts, suppliers, status"),
      fileSlug: "purchase-register",
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
        title: s.t("table_title", "Purchase Bookings"),
        columns: pdfCols,
        rows: prows,
        totals: {
          amount: prows.reduce((a, r) => a + r.amount, 0),
          finalAmount: prows.reduce((a, r) => a + r.finalAmount, 0),
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
    const lines = rows.map((r) => [r.displayBillNumber || r.purchase_order_no || "—", r.manualBillNumber || "—", r.purchaseDate ? new Date(r.purchaseDate).toLocaleDateString("en-GB") : "", `"${r.supplierName || "—"}"`, `"${r.productName || "—"}"`, int(r.quantity), money(r.purchaseRate), money(r.purchaseAmount), money(r.finalAmount ?? r.purchaseAmount), r.status || "—"].join(","));
    const blob = new Blob(["﻿" + [head, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `purchase-register-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "Purchase Register")}
      subtitle={s.t("subtitle", "All purchase bookings — amounts, suppliers, status")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_purchase", "Purchase Reports"),
          items: [
            { value: "purchase-register", label: s.t("opt_register", "Purchase Register") },
            { value: "purchase-booking", label: s.t("opt_booking", "Purchase Booking Journal") },
            { value: "purchase-completed", label: s.t("opt_completed", "Completed Purchases") },
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
          { value: "accepted", label: s.t("t_accepted", "Accepted") },
          { value: "transferred", label: s.t("t_transferred", "Transferred") },
          { value: "complet", label: s.t("t_completed", "Completed") },
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
        title: s.t("table_title", "Purchase Bookings"),
        subtitle: s.t("table_sub", "One row per purchase booking"),
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
