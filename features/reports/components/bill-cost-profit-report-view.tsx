"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Coins, ClipboardList, TrendingUp } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { apiGet } from "@/lib/api/client";
import type { ReportContext } from "@/lib/reports/resolve-report-context";
import {
  UniversalReportShell,
  type ReportFilterState,
  type ReportMetaOption,
  type ReportCard,
  type ReportTableColumn,
} from "./universal-report-shell";
import { openUniversalReport, type UrpColumn } from "@/lib/reports/universal-report-print";
import { translateHeader } from "@/lib/i18n/table-headers";

type ApiCol = { key: string; label: string; align?: "left" | "right" | "center"; kind?: string };
type Payload = { columns: ApiCol[]; rows: Array<Record<string, unknown>>; totals: Record<string, unknown> };

const EMPTY: ReportFilterState = { dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "" };
const money = (n: unknown) => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: unknown) => (Number(n) || 0).toLocaleString("en-US");

// report keys exposed by /api/erp/bill-expenses/reports
const REPORTS = [
  "bill_wise_expense", "bill_wise_final_cost", "purchase_cost", "sales_and_profit",
  "expense_type", "country_wise", "branch_wise", "party_wise",
  "container_shipment_cost", "currency_wise_expense", "outstanding_unpaid_expense", "profit_loss_by_bill",
] as const;

export function BillCostProfitReportView({
  context, countries,
}: { context: ReportContext; countries: ReportMetaOption[] }) {
  const s = useErpScreen("bcprep");
  const [report, setReport] = useState<string>("bill_wise_expense");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ report });
      if (applied.dateFrom) qs.set("fromDate", applied.dateFrom);
      if (applied.dateTo) qs.set("toDate", applied.dateTo);
      if (applied.countryId) qs.set("countryId", applied.countryId);
      const res = await apiGet<Payload>(`/api/erp/bill-expenses/reports?${qs.toString()}`);
      setData(res);
    } catch {
      setData({ columns: [], rows: [], totals: {} });
    } finally {
      setLoading(false);
    }
  }, [report, applied]);
  useEffect(() => { void load(); }, [load]);

  const rows = data?.rows ?? [];
  const totals = data?.totals ?? {};
  const apiCols = data?.columns ?? [];

  // the module cards adapt to whichever numeric totals the selected report returned
  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => {
    const t = totals as Record<string, number>;
    const financialRows = [
      t.bills !== undefined ? { label: s.t("k_bills", "Bills"), value: num(t.bills), mono: true, tone: "strong" as const } : null,
      t.lines !== undefined ? { label: s.t("k_lines", "Expense Lines"), value: num(t.lines), mono: true } : null,
      t.original !== undefined ? { label: s.t("k_original", "Original Amount"), value: money(t.original), mono: true } : null,
      t.postedExpense !== undefined ? { label: s.t("k_posted", "Posted Expense"), value: money(t.postedExpense), tone: "positive" as const, mono: true } : null,
      t.posted !== undefined ? { label: s.t("k_posted", "Posted Expense"), value: money(t.posted), tone: "positive" as const, mono: true } : null,
      t.draftExpense !== undefined ? { label: s.t("k_draft", "Draft / Unposted"), value: money(t.draftExpense), tone: "muted" as const, mono: true } : null,
      t.unposted !== undefined ? { label: s.t("k_draft", "Draft / Unposted"), value: money(t.unposted), tone: "muted" as const, mono: true } : null,
    ].filter(Boolean) as ReportCard["rows"];
    const landed = t.landed ?? t.total;
    const financial: ReportCard = {
      key: "financial",
      title: s.t("card_financial", "Cost & Expense Summary"),
      subtitle: s.t("card_financial_sub", "Totals for the selected report"),
      icon: <Coins className="h-4 w-4" />,
      accent: "emerald",
      rows: financialRows.length ? financialRows : [{ label: s.t("k_rows", "Report Rows"), value: rows.length, mono: true }],
      footer: landed !== undefined ? { label: s.t("k_landed", "Landed / Total"), value: money(landed), tone: "strong" } : undefined,
    };
    const profit: ReportCard = {
      key: "profit",
      title: s.t("card_profit", "Profit / Loss"),
      subtitle: s.t("card_profit_sub", "Revenue vs landed cost (where computed)"),
      icon: <TrendingUp className="h-4 w-4" />,
      accent: "purple",
      rows: [
        { label: s.t("p_revenue", "Revenue"), value: money(t.revenue), mono: true, tone: "positive" },
        { label: s.t("p_landed", "Landed Cost"), value: money(t.landed ?? t.original), mono: true, tone: "negative" },
        { label: s.t("p_rows", "Rows in Report"), value: rows.length, mono: true },
      ],
      footer: t.profit !== undefined
        ? { label: s.t("p_profit", "Profit / Loss"), value: money(t.profit), tone: (Number(t.profit) || 0) >= 0 ? "positive" : "negative" }
        : undefined,
    };
    const coverage: ReportCard = {
      key: "coverage",
      title: s.t("card_coverage", "Register Coverage"),
      subtitle: s.t("card_coverage_sub", "Bill-Expense register footprint"),
      icon: <ClipboardList className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("g_report", "Active Report"), value: s.t(`opt_${report}`, report.replace(/_/g, " ")) },
        { label: s.t("g_rows", "Rows"), value: rows.length, mono: true },
        { label: s.t("g_parties", "Distinct Parties"), value: new Set(rows.map((r) => r.party ?? r.group).filter(Boolean)).size, mono: true },
      ],
      footer: t.bills !== undefined ? { label: s.t("g_total_bills", "Register Bills"), value: num(t.bills), tone: "strong" } : undefined,
    };
    return [financial, profit, coverage];
  }, [s, totals, rows, report]);

  const shellCols: ReportTableColumn[] = apiCols.map((c) => ({
    key: c.key,
    label: translateHeader(s.lang, c.label),
    align: c.align === "right" ? "end" : c.align === "center" ? "center" : "start",
    render: (r: Record<string, unknown>) => {
      const v = r[c.key];
      if (c.kind === "money") return money(v);
      if (c.kind === "qty") return num(v);
      if (c.kind === "date") return v ? new Date(String(v)).toLocaleDateString("en-GB") : "—";
      return String(v ?? "—");
    },
  }));

  const printInput = () => {
    const pdfCols: UrpColumn[] = apiCols.map((c) => ({
      key: c.key, label: translateHeader(s.lang, c.label),
      align: c.align === "right" ? "end" : c.align === "center" ? "center" : "start",
      format: c.kind === "money" ? "currency" : c.kind === "qty" ? "number" : c.kind === "date" ? "date" : "text",
    }));
    const prows = rows.map((r) => {
      const o: Record<string, unknown> = { ...r };
      for (const c of apiCols) if (c.kind === "date" && o[c.key]) o[c.key] = new Date(String(o[c.key])).toLocaleDateString("en-GB");
      return o;
    });
    return {
      lang: s.lang,
      title: s.t("title", "Bill Cost, Expenses & Profit"),
      subtitle: s.t(`opt_${report}`, report.replace(/_/g, " ")),
      fileSlug: `bill-cost-profit-${report}`,
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
        title: s.t(`opt_${report}`, report.replace(/_/g, " ")),
        columns: pdfCols,
        rows: prows,
        totals: totals as Record<string, string | number>,
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
    const head = apiCols.map((c) => translateHeader(s.lang, c.label)).join(",");
    const lines = rows.map((r) => apiCols.map((c) => {
      const v = r[c.key];
      if (c.kind === "money") return money(v);
      if (c.kind === "date" && v) return new Date(String(v)).toLocaleDateString("en-GB");
      return `"${String(v ?? "").replace(/"/g, "'")}"`;
    }).join(","));
    const blob = new Blob(["﻿" + [head, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bill-cost-profit-${report}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "Bill Cost, Expenses & Profit")}
      subtitle={s.t("subtitle", "Expense, landed cost and profit across every bill")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_expense", "Expense Reports"),
          items: [
            { value: "bill_wise_expense", label: s.t("opt_bill_wise_expense", "Bill-wise Expense") },
            { value: "expense_type", label: s.t("opt_expense_type", "Expense Type") },
            { value: "outstanding_unpaid_expense", label: s.t("opt_outstanding_unpaid_expense", "Outstanding / Unpaid Expense") },
            { value: "currency_wise_expense", label: s.t("opt_currency_wise_expense", "Currency-wise Expense") },
          ],
        },
        {
          label: s.t("grp_cost", "Cost Reports"),
          items: [
            { value: "bill_wise_final_cost", label: s.t("opt_bill_wise_final_cost", "Bill-wise Final Cost") },
            { value: "purchase_cost", label: s.t("opt_purchase_cost", "Purchase Cost") },
            { value: "container_shipment_cost", label: s.t("opt_container_shipment_cost", "Container / Shipment Cost") },
          ],
        },
        {
          label: s.t("grp_profit", "Profit Reports"),
          items: [
            { value: "sales_and_profit", label: s.t("opt_sales_and_profit", "Sales & Profit") },
            { value: "profit_loss_by_bill", label: s.t("opt_profit_loss_by_bill", "Profit / Loss by Bill") },
          ],
        },
        {
          label: s.t("grp_geo", "By Country / Branch / Party"),
          items: [
            { value: "country_wise", label: s.t("opt_country_wise", "Country-wise") },
            { value: "branch_wise", label: s.t("opt_branch_wise", "Branch-wise") },
            { value: "party_wise", label: s.t("opt_party_wise", "Party-wise") },
          ],
        },
      ]}
      selectedReport={report}
      onSelectReport={(v) => { if ((REPORTS as readonly string[]).includes(v)) setReport(v); }}
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
        title: s.t(`opt_${report}`, report.replace(/_/g, " ")),
        subtitle: s.t("table_sub", "Live from the Bill-Expense register"),
        columns: shellCols.length ? shellCols : [{ key: "_", label: "—", align: "start" }],
        rows: rows,
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
