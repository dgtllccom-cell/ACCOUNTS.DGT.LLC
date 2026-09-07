"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wallet, Layers, Globe2 } from "lucide-react";
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
const num = (n: unknown) => (Number(n) || 0).toLocaleString("en-US");
const dt = (v: unknown) => { const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? String(v ?? "—") : d.toLocaleDateString("en-GB"); };

const TYPES = ["directory", "balances", "by_category"] as const;
type ReportType = (typeof TYPES)[number];

export function AccountMasterReportView({
  context, countries,
}: { context: ReportContext; countries: ReportMetaOption[] }) {
  const s = useErpScreen("acmrep");
  const [type, setType] = useState<ReportType>("directory");
  const [raw, setRaw] = useState<Any[]>([]);
  const [summary, setSummary] = useState<Any>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = applied.countryId ? `?countryId=${applied.countryId}` : "";
      const r = await apiGet<Any>(`/api/erp/accounting/reports/accounts/general${qs}`);
      setRaw(Array.isArray(r?.rows) ? (r.rows as Any[]) : []);
      setSummary((r?.summary ?? {}) as Any);
    } catch {
      setRaw([]); setSummary({});
    } finally {
      setLoading(false);
    }
  }, [applied]);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    let out = raw;
    if (applied.countryId) out = out.filter((r) => String(r.countryId) === applied.countryId);
    return out;
  }, [raw, applied]);

  const rows: Row[] = useMemo(() => {
    if (type === "by_category") {
      type Cat = { category: string; accounts: number; debit: number; credit: number; balance: number };
      const map = new Map<string, Cat>();
      for (const a of filtered) {
        const g = String(a.accountCategory || a.subType || "—");
        const cur: Cat = map.get(g) || { category: g, accounts: 0, debit: 0, credit: 0, balance: 0 };
        cur.accounts += 1;
        cur.debit += Number(a.debitTotal) || 0;
        cur.credit += Number(a.creditTotal) || 0;
        cur.balance += Number(a.currentBalance) || 0;
        map.set(g, cur);
      }
      return [...map.values()];
    }
    return filtered.map((a) => ({
      accountCode: a.accountCode,
      accountName: a.accountName,
      ledgerName: a.ledgerName,
      currency: a.ledgerCurrency || a.currency,
      accountCategory: a.accountCategory || a.subType || "—",
      countryName: a.countryName,
      branchName: a.cityBranchName || a.branchName || a.mainBranchName,
      status: a.status,
      openingBalance: a.openingBalance,
      debitTotal: a.debitTotal,
      creditTotal: a.creditTotal,
      currentBalance: a.currentBalance,
      latestActivityAt: a.latestActivityAt,
    }));
  }, [filtered, type]);

  const columns = useMemo(() => {
    if (type === "by_category") return [
      { key: "category", label: s.t("c_category", "Account Category"), kind: "text" as const },
      { key: "accounts", label: s.t("c_accounts", "Accounts"), align: "end" as const, kind: "qty" as const },
      { key: "debit", label: s.t("c_debit", "Debit"), align: "end" as const, kind: "money" as const },
      { key: "credit", label: s.t("c_credit", "Credit"), align: "end" as const, kind: "money" as const },
      { key: "balance", label: s.t("c_balance", "Balance"), align: "end" as const, kind: "money" as const },
    ];
    if (type === "balances") return [
      { key: "accountCode", label: s.t("c_code", "Account Code"), kind: "text" as const },
      { key: "accountName", label: s.t("c_name", "Account Name"), kind: "text" as const },
      { key: "currency", label: s.t("c_currency", "Currency"), align: "center" as const, kind: "text" as const },
      { key: "openingBalance", label: s.t("c_opening", "Opening"), align: "end" as const, kind: "money" as const },
      { key: "debitTotal", label: s.t("c_debit", "Debit"), align: "end" as const, kind: "money" as const },
      { key: "creditTotal", label: s.t("c_credit", "Credit"), align: "end" as const, kind: "money" as const },
      { key: "currentBalance", label: s.t("c_balance", "Current Balance"), align: "end" as const, kind: "money" as const },
    ];
    return [
      { key: "accountCode", label: s.t("c_code", "Account Code"), kind: "text" as const },
      { key: "accountName", label: s.t("c_name", "Account Name"), kind: "text" as const },
      { key: "ledgerName", label: s.t("c_ledger", "Ledger"), kind: "text" as const },
      { key: "accountCategory", label: s.t("c_category", "Category"), kind: "text" as const },
      { key: "currency", label: s.t("c_currency", "Currency"), align: "center" as const, kind: "text" as const },
      { key: "countryName", label: s.t("c_country", "Country"), kind: "text" as const },
      { key: "branchName", label: s.t("c_branch", "Branch"), kind: "text" as const },
      { key: "status", label: s.t("c_status", "Status"), align: "center" as const, kind: "text" as const },
      { key: "currentBalance", label: s.t("c_balance", "Balance"), align: "end" as const, kind: "money" as const },
      { key: "latestActivityAt", label: s.t("c_last", "Last Activity"), kind: "date" as const },
    ];
  }, [type, s]);

  const sum = (k: string) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const distinct = (k: string) => new Set(rows.map((r) => r[k]).filter(Boolean)).size;
  const sm = summary as Record<string, number>;

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "summary",
      title: s.t("card_summary", "Account Master Summary"),
      subtitle: s.t(`opt_${type}`, type),
      icon: <Wallet className="h-4 w-4" />,
      accent: "blue",
      rows: [
        { label: s.t("k_total", "Total Accounts"), value: num(sm.totalAccounts ?? filtered.length), mono: true, tone: "strong" },
        { label: s.t("k_active", "Active Accounts"), value: num(sm.activeAccounts ?? 0), tone: "positive", mono: true },
        { label: s.t("k_ledgers", "Linked Ledgers"), value: num(sm.totalLedgers ?? 0), mono: true },
      ],
      footer: { label: s.t("k_balance", "Current Balance Total"), value: money(sm.currentBalanceTotal ?? sum("currentBalance")), tone: "strong" },
    },
    {
      key: "flows",
      title: s.t("card_flows", "Debit / Credit"),
      subtitle: s.t("card_flows_sub", "Posted totals"),
      icon: <Layers className="h-4 w-4" />,
      accent: "purple",
      rows: [
        { label: s.t("b_debit", "Debit Total"), value: money(sm.debitTotal ?? sum("debitTotal")), mono: true, tone: "negative" },
        { label: s.t("b_credit", "Credit Total"), value: money(sm.creditTotal ?? sum("creditTotal")), mono: true, tone: "positive" },
        { label: s.t("b_country", "Country Accounts"), value: num(sm.countryAccounts ?? 0), mono: true },
        { label: s.t("b_branch", "Branch Accounts"), value: num(sm.branchAccounts ?? 0), mono: true },
      ],
    },
    {
      key: "coverage",
      title: s.t("card_coverage", "Coverage"),
      subtitle: s.t("card_coverage_sub", "Countries, branches, categories (loaded rows)"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("c_countries", "Countries"), value: distinct("countryName"), mono: true },
        { label: s.t("c_branches", "Branches"), value: distinct("branchName"), mono: true },
        { label: s.t("c_categories", "Categories"), value: distinct("accountCategory") || distinct("category"), mono: true },
      ],
      footer: { label: s.t("c_report", "Active Report"), value: s.t(`opt_${type}`, type) },
    },
  ], [s, rows, filtered, summary, type]);

  const fmt = (c: (typeof columns)[number], v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (c.kind === "money") return money(v);
    if (c.kind === "qty") return num(v);
    if (c.kind === "date") return dt(v);
    return String(v);
  };

  const shellCols: ReportTableColumn[] = columns.map((c) => ({
    key: c.key, label: c.label, align: c.align ?? "start",
    render: (r: Row) => fmt(c, r[c.key]),
  }));

  const footerRow: Row = {};
  columns.forEach((c, i) => { footerRow[c.key] = c.kind === "money" || c.kind === "qty" ? sum(c.key) : i === 0 ? s.t("row_total", "Total") : ""; });

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
      title: s.t("title", "Account Master Reports"),
      subtitle: s.t(`opt_${type}`, type),
      fileSlug: `account-master-report-${type}`,
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
    a.download = `account-master-report-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "Account Master Reports")}
      subtitle={s.t("subtitle", "Chart of accounts, balances and categories")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_accounts", "Account Master"),
          items: [
            { value: "directory", label: s.t("opt_directory", "Account Directory") },
            { value: "balances", label: s.t("opt_balances", "Account Balances") },
            { value: "by_category", label: s.t("opt_by_category", "By Category") },
          ],
        },
      ]}
      selectedReport={type}
      onSelectReport={(v) => { if ((TYPES as readonly string[]).includes(v)) setType(v as ReportType); }}
      filters={filters}
      onFiltersChange={setFilters}
      onApplyFilters={() => setApplied(filters)}
      filterOptions={{ countries, states: [], cities: [], branches: [], statuses: [] }}
      showFilters={{ dateFrom: false, dateTo: false, stateId: false, cityId: false, branchId: false, status: false }}
      branchUser={{
        country: context.country, state: context.state, city: context.city,
        branchName: context.branchName, branchCode: context.branchCode,
        userId: context.userId.slice(0, 18), userName: context.userName, role: context.role,
        accessScope: context.accessScope, dateTime: new Date().toLocaleString("en-GB"), online: context.online,
      }}
      cards={cards}
      table={{
        title: s.t(`opt_${type}`, type),
        subtitle: s.t("table_sub", "Live from the accounts general report"),
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
