"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Scale, PieChart, Landmark } from "lucide-react";
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

type Any = Record<string, unknown>;
type Row = Record<string, unknown>;

const EMPTY: ReportFilterState = { dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "" };
const money = (n: unknown) => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TYPES = ["trial_balance", "balance_sheet", "profit_loss", "cash_flow"] as const;
type ReportType = (typeof TYPES)[number];

function scopeFor(ctx: ReportContext): "super_admin" | "country" | "main_branch" | "city_branch" {
  if (ctx.accessScope === "Global") return "super_admin";
  if (ctx.cityBranchId) return "city_branch";
  if (ctx.countryBranchId) return "main_branch";
  return "country";
}

export function FinancialStatementsReportView({
  context, countries,
}: { context: ReportContext; countries: ReportMetaOption[] }) {
  const s = useErpScreen("finrep");
  const scope = scopeFor(context);
  const year = new Date().getFullYear();
  const [type, setType] = useState<ReportType>("trial_balance");
  const [rowsRaw, setRowsRaw] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Any>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilterState>({ ...EMPTY, dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` });
  const [applied, setApplied] = useState<ReportFilterState>({ ...EMPTY, dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = applied.dateFrom || `${year}-01-01`;
      const to = applied.dateTo || `${year}-12-31`;
      const cty = applied.countryId ? `&countryId=${applied.countryId}` : "";
      if (type === "trial_balance") {
        const r = await apiGet<Any>(`/api/erp/accounting/reports/trial-balance?scope=${scope}&asOfDate=${to}${cty}`);
        const rows = (Array.isArray(r?.rows) ? r.rows : []) as Any[];
        setRowsRaw(rows.map((x) => ({
          section: s.t("sec_ledger", "Ledger"),
          code: x.code, name: x.name, currency: x.currency,
          opening: x.opening_balance, debit: x.debit_total, credit: x.credit_total, balance: x.balance,
        })));
        setMeta({ asOf: r?.asOfDate });
      } else if (type === "balance_sheet") {
        const r = await apiGet<Any>(`/api/erp/accounting/reports/balance-sheet?scope=${scope}&asOfDate=${to}${cty}`);
        const mk = (arr: unknown, sec: string) => (Array.isArray(arr) ? arr : []).map((x: Any) => ({
          section: sec, code: x.code, name: x.name, balance: x.closing_balance,
        }));
        setRowsRaw([
          ...mk(r?.assets, s.t("sec_assets", "Assets")),
          ...mk(r?.liabilities, s.t("sec_liabilities", "Liabilities")),
          ...mk(r?.equity, s.t("sec_equity", "Equity")),
        ]);
        setMeta({ totals: r?.totals, retained: r?.retainedEarnings });
      } else if (type === "profit_loss") {
        const r = await apiGet<Any>(`/api/erp/accounting/reports/profit-and-loss?scope=${scope}&fromDate=${from}&toDate=${to}${cty}`);
        const mk = (arr: unknown, sec: string) => (Array.isArray(arr) ? arr : []).map((x: Any) => ({
          section: sec, code: x.code, name: x.name, amount: x.amount,
        }));
        setRowsRaw([
          ...mk(r?.income, s.t("sec_income", "Income")),
          ...mk(r?.expense, s.t("sec_expense", "Expense")),
        ]);
        setMeta({ totals: r?.totals });
      } else {
        const r = await apiGet<Any>(`/api/erp/accounting/reports/cash-flow?scope=${scope}&fromDate=${from}&toDate=${to}${cty}`);
        const mk = (arr: unknown, sec: string) => (Array.isArray(arr) ? arr : []).map((x: Any) => ({
          section: sec, code: x.code ?? x.account_code, name: x.name ?? x.account_name,
          opening: x.openingBalance ?? x.opening_balance, movement: x.netMovement ?? x.net_movement ?? x.movement,
          closing: x.closingBalance ?? x.closing_balance,
        }));
        setRowsRaw([
          ...mk(r?.bankAccounts, s.t("sec_bank", "Bank")),
          ...mk(r?.cashAccounts, s.t("sec_cash", "Cash")),
        ]);
        setMeta({ totals: r?.totals });
      }
    } catch {
      setRowsRaw([]);
      setMeta({});
    } finally {
      setLoading(false);
    }
  }, [type, applied, scope, year, s]);
  useEffect(() => { void load(); }, [load]);

  const rows = rowsRaw;

  const columns = useMemo(() => {
    if (type === "trial_balance") return [
      { key: "section", label: s.t("c_section", "Section"), kind: "text" as const },
      { key: "code", label: s.t("c_code", "Ledger Code"), kind: "text" as const },
      { key: "name", label: s.t("c_name", "Ledger Name"), kind: "text" as const },
      { key: "currency", label: s.t("c_currency", "Currency"), align: "center" as const, kind: "text" as const },
      { key: "opening", label: s.t("c_opening", "Opening"), align: "end" as const, kind: "money" as const },
      { key: "debit", label: s.t("c_debit", "Debit"), align: "end" as const, kind: "money" as const },
      { key: "credit", label: s.t("c_credit", "Credit"), align: "end" as const, kind: "money" as const },
      { key: "balance", label: s.t("c_balance", "Balance"), align: "end" as const, kind: "money" as const },
    ];
    if (type === "balance_sheet") return [
      { key: "section", label: s.t("c_section", "Section"), kind: "text" as const },
      { key: "code", label: s.t("c_code", "Account Code"), kind: "text" as const },
      { key: "name", label: s.t("c_name", "Account Name"), kind: "text" as const },
      { key: "balance", label: s.t("c_balance", "Balance"), align: "end" as const, kind: "money" as const },
    ];
    if (type === "profit_loss") return [
      { key: "section", label: s.t("c_section", "Section"), kind: "text" as const },
      { key: "code", label: s.t("c_code", "Account Code"), kind: "text" as const },
      { key: "name", label: s.t("c_name", "Account Name"), kind: "text" as const },
      { key: "amount", label: s.t("c_amount", "Amount"), align: "end" as const, kind: "money" as const },
    ];
    return [
      { key: "section", label: s.t("c_section", "Section"), kind: "text" as const },
      { key: "code", label: s.t("c_code", "Account Code"), kind: "text" as const },
      { key: "name", label: s.t("c_name", "Account Name"), kind: "text" as const },
      { key: "opening", label: s.t("c_opening", "Opening"), align: "end" as const, kind: "money" as const },
      { key: "movement", label: s.t("c_movement", "Net Movement"), align: "end" as const, kind: "money" as const },
      { key: "closing", label: s.t("c_closing", "Closing"), align: "end" as const, kind: "money" as const },
    ];
  }, [type, s]);

  const sum = (k: string) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const sectionSum = (sec: string, k: string) => rows.filter((r) => r.section === sec).reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const t = (meta.totals ?? {}) as Record<string, number>;

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => {
    const perType: Record<ReportType, ReportCard["rows"]> = {
      trial_balance: [
        { label: s.t("k_ledgers", "Ledgers"), value: rows.length, mono: true, tone: "strong" },
        { label: s.t("k_debit", "Total Debit"), value: money(sum("debit")), mono: true },
        { label: s.t("k_credit", "Total Credit"), value: money(sum("credit")), mono: true },
      ],
      balance_sheet: [
        { label: s.t("k_assets", "Total Assets"), value: money(t.totalAssets ?? sectionSum(s.t("sec_assets", "Assets"), "balance")), mono: true, tone: "positive" },
        { label: s.t("k_liabilities", "Total Liabilities"), value: money(t.totalLiabilities ?? sectionSum(s.t("sec_liabilities", "Liabilities"), "balance")), mono: true, tone: "negative" },
        { label: s.t("k_equity", "Total Equity"), value: money(t.totalEquity ?? sectionSum(s.t("sec_equity", "Equity"), "balance")), mono: true },
      ],
      profit_loss: [
        { label: s.t("k_income", "Total Income"), value: money(t.totalIncome ?? sectionSum(s.t("sec_income", "Income"), "amount")), mono: true, tone: "positive" },
        { label: s.t("k_expense", "Total Expense"), value: money(t.totalExpense ?? sectionSum(s.t("sec_expense", "Expense"), "amount")), mono: true, tone: "negative" },
        { label: s.t("k_net", "Net Profit"), value: money(t.netProfit ?? 0), mono: true, tone: "strong" },
      ],
      cash_flow: [
        { label: s.t("k_open", "Opening Balance"), value: money(t.openingBalance ?? 0), mono: true },
        { label: s.t("k_move", "Net Movement"), value: money(t.netMovement ?? 0), mono: true },
        { label: s.t("k_close", "Closing Balance"), value: money(t.closingBalance ?? 0), mono: true, tone: "strong" },
      ],
    };
    return [
      {
        key: "summary",
        title: s.t("card_summary", "Statement Summary"),
        subtitle: s.t(`opt_${type}`, type),
        icon: <Scale className="h-4 w-4" />,
        accent: "blue",
        rows: perType[type],
      },
      {
        key: "sections",
        title: s.t("card_sections", "Section Breakdown"),
        subtitle: s.t("card_sections_sub", "Line count by section (loaded rows)"),
        icon: <PieChart className="h-4 w-4" />,
        accent: "purple",
        rows: [...new Set(rows.map((r) => String(r.section)))].slice(0, 4).map((sec) => ({
          label: sec, value: rows.filter((r) => r.section === sec).length, mono: true,
        })),
      },
      {
        key: "scope",
        title: s.t("card_scope", "Reporting Basis"),
        subtitle: s.t("card_scope_sub", "Scope and period"),
        icon: <Landmark className="h-4 w-4" />,
        accent: "orange",
        rows: [
          { label: s.t("c_scope_lvl", "Scope"), value: scope.replace(/_/g, " ") },
          { label: s.t("c_period", "Period"), value: `${applied.dateFrom || "…"} → ${applied.dateTo || "…"}` },
          { label: s.t("c_lines", "Lines"), value: rows.length, mono: true },
        ],
        footer: { label: s.t("c_report", "Active Report"), value: s.t(`opt_${type}`, type) },
      },
    ];
  }, [s, rows, type, t, scope, applied]);

  const fmt = (c: (typeof columns)[number], v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (c.kind === "money") return money(v);
    return String(v);
  };

  const shellCols: ReportTableColumn[] = columns.map((c) => ({
    key: c.key, label: c.label, align: c.align ?? "start",
    render: (r: Row) => fmt(c, r[c.key]),
  }));

  const footerRow: Row = {};
  columns.forEach((c, i) => { footerRow[c.key] = c.kind === "money" ? sum(c.key) : i === 0 ? s.t("row_total", "Total") : ""; });

  const printInput = () => {
    const pdfCols: UrpColumn[] = columns.map((c) => ({ key: c.key, label: c.label, align: c.align ?? "start" }));
    const prows = rows.map((r) => {
      const o: Row = {};
      for (const c of columns) o[c.key] = fmt(c, r[c.key]);
      return o;
    });
    const totals: Record<string, string | number> = {};
    for (const c of columns) if (c.kind === "money") totals[c.key] = money(sum(c.key));
    return {
      lang: s.lang,
      title: s.t("title", "Financial Statements"),
      subtitle: s.t(`opt_${type}`, type),
      fileSlug: `financial-statement-${type}`,
      orientation: "landscape" as const,
      branchUser: {
        country: context.country, state: context.state, city: context.city,
        branchName: context.branchName, branchCode: context.branchCode,
        userId: context.userId, userName: context.userName, role: context.role,
        accessScope: context.accessScope, dateTime: new Date().toLocaleString("en-GB"), online: context.online,
      },
      cards: cards.map((c) => ({ title: c.title, subtitle: c.subtitle, rows: c.rows.map((r) => ({ ...r })), footer: c.footer })),
      appliedFilters: [
        { label: s.tGlobal("urs.f_date_range", "Date Range"), value: `${applied.dateFrom || "…"} → ${applied.dateTo || "…"}` },
        applied.countryId ? { label: s.tGlobal("urs.f_country", "Country"), value: countries.find((c) => c.id === applied.countryId)?.name ?? applied.countryId } : null,
      ].filter(Boolean) as Array<{ label: string; value: string }>,
      table: { title: s.t(`opt_${type}`, type), columns: pdfCols, rows: prows, totals: Object.keys(totals).length ? totals : undefined },
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
    const head = columns.map((c) => c.label).join(",");
    const lines = rows.map((r) => columns.map((c) => `"${fmt(c, r[c.key]).replace(/"/g, "'")}"`).join(","));
    const blob = new Blob(["﻿" + [head, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `financial-statement-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "Financial Statements")}
      subtitle={s.t("subtitle", "Trial balance, balance sheet, P&L and cash flow")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_statements", "Financial Statements"),
          items: [
            { value: "trial_balance", label: s.t("opt_trial_balance", "Trial Balance") },
            { value: "balance_sheet", label: s.t("opt_balance_sheet", "Balance Sheet") },
            { value: "profit_loss", label: s.t("opt_profit_loss", "Profit & Loss") },
            { value: "cash_flow", label: s.t("opt_cash_flow", "Cash Flow") },
          ],
        },
      ]}
      selectedReport={type}
      onSelectReport={(v) => { if ((TYPES as readonly string[]).includes(v)) setType(v as ReportType); }}
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
        title: s.t(`opt_${type}`, type),
        subtitle: s.t("table_sub", "Live from the accounting statement engine"),
        columns: shellCols,
        rows,
        totalCount: rows.length,
        footerRow: rows.length ? footerRow : undefined,
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
