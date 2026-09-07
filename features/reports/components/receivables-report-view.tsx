"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Wallet, Clock, Globe2 } from "lucide-react";
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

type OutRow = {
  id: string; code: string; name: string; currency: string; countryId: string | null;
  scope: string; openingBalance: number; outstanding: number; side: string;
  debitTotal: number; creditTotal: number; lastMovementDate: string | null; daysOutstanding: number;
};
type Row = Record<string, unknown>;

const EMPTY: ReportFilterState = { dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "" };
const money = (n: unknown) => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n: unknown) => (Number(n) || 0).toLocaleString("en-US");
const dt = (v: unknown) => { const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? String(v ?? "—") : d.toLocaleDateString("en-GB"); };

const TYPES = ["all", "receivable", "payable", "aging"] as const;
type ReportType = (typeof TYPES)[number];

export function ReceivablesReportView({
  context, countries,
}: { context: ReportContext; countries: ReportMetaOption[] }) {
  const s = useErpScreen("recrep");
  const [type, setType] = useState<ReportType>("all");
  const [raw, setRaw] = useState<OutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY);

  const countryName = useMemo(() => new Map(countries.map((c) => [c.id, c.name])), [countries]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ rows: OutRow[] }>(`/api/erp/accounting/reports/ledger/outstanding`);
      setRaw(Array.isArray(r?.rows) ? r.rows : []);
    } catch {
      setRaw([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const rows: Row[] = useMemo(() => {
    let out = raw;
    if (type === "receivable") out = out.filter((r) => r.side === "debit");
    if (type === "payable") out = out.filter((r) => r.side === "credit");
    if (applied.countryId) out = out.filter((r) => String(r.countryId) === applied.countryId);
    return out
      .slice()
      .sort((a, b) => (type === "aging" ? b.daysOutstanding - a.daysOutstanding : b.outstanding - a.outstanding))
      .map((r) => ({
        code: r.code,
        name: r.name,
        currency: r.currency,
        country: r.countryId ? (countryName.get(r.countryId) ?? "—") : "—",
        side: r.side === "debit" ? s.t("v_receivable", "Receivable") : s.t("v_payable", "Payable"),
        opening: r.openingBalance,
        debit: r.debitTotal,
        credit: r.creditTotal,
        outstanding: r.outstanding,
        lastMovement: r.lastMovementDate,
        days: r.daysOutstanding,
        bucket:
          r.daysOutstanding <= 30 ? "0–30" :
          r.daysOutstanding <= 60 ? "31–60" :
          r.daysOutstanding <= 90 ? "61–90" :
          r.daysOutstanding <= 180 ? "91–180" : "180+",
      }));
  }, [raw, type, applied, countryName, s]);

  const columns = useMemo(() => {
    const base: Array<{ key: string; label: string; align?: "start" | "center" | "end"; kind?: "money" | "qty" | "date" | "text" }> = [
      { key: "code", label: s.t("c_code", "Account Code"), kind: "text" },
      { key: "name", label: s.t("c_name", "Account Name"), kind: "text" },
      { key: "country", label: s.t("c_country", "Country"), kind: "text" },
      { key: "currency", label: s.t("c_currency", "Currency"), align: "center", kind: "text" },
      { key: "side", label: s.t("c_side", "Type"), align: "center", kind: "text" },
      { key: "outstanding", label: s.t("c_outstanding", "Outstanding"), align: "end", kind: "money" },
      { key: "days", label: s.t("c_days", "Days"), align: "end", kind: "qty" },
      { key: "lastMovement", label: s.t("c_last", "Last Movement"), kind: "date" },
    ];
    if (type === "aging") base.splice(6, 0, { key: "bucket", label: s.t("c_bucket", "Aging Bucket"), align: "center", kind: "text" });
    return base;
  }, [type, s]);

  const sum = (k: string) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const distinct = (k: string) => new Set(rows.map((r) => r[k]).filter(Boolean)).size;

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "summary",
      title: s.t("card_summary", "Outstanding Summary"),
      subtitle: s.t(`opt_${type}`, type),
      icon: <Wallet className="h-4 w-4" />,
      accent: "blue",
      rows: [
        { label: s.t("k_rows", "Accounts"), value: rows.length, mono: true, tone: "strong" },
        { label: s.t("k_receivable", "Total Receivable"), value: money(rows.filter((r) => r.side === s.t("v_receivable", "Receivable")).reduce((a, r) => a + (Number(r.outstanding) || 0), 0)), mono: true, tone: "positive" },
        { label: s.t("k_payable", "Total Payable"), value: money(rows.filter((r) => r.side === s.t("v_payable", "Payable")).reduce((a, r) => a + (Number(r.outstanding) || 0), 0)), mono: true, tone: "negative" },
      ],
      footer: { label: s.t("k_net", "Net Outstanding"), value: money(sum("outstanding")), tone: "strong" },
    },
    {
      key: "aging",
      title: s.t("card_aging", "Aging"),
      subtitle: s.t("card_aging_sub", "By days outstanding (loaded rows)"),
      icon: <Clock className="h-4 w-4" />,
      accent: "rose",
      rows: [
        { label: "0–30", value: rows.filter((r) => r.bucket === "0–30").length, mono: true },
        { label: "31–90", value: rows.filter((r) => r.bucket === "31–60" || r.bucket === "61–90").length, mono: true },
        { label: "91–180", value: rows.filter((r) => r.bucket === "91–180").length, mono: true },
        { label: "180+", value: rows.filter((r) => r.bucket === "180+").length, tone: "negative", mono: true },
      ],
    },
    {
      key: "coverage",
      title: s.t("card_coverage", "Coverage"),
      subtitle: s.t("card_coverage_sub", "Countries & currencies (loaded rows)"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("c_countries", "Countries"), value: distinct("country"), mono: true },
        { label: s.t("c_currencies", "Currencies"), value: distinct("currency"), mono: true },
      ],
      footer: { label: s.t("c_report", "Active Report"), value: s.t(`opt_${type}`, type) },
    },
  ], [s, rows, type]);

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
      title: s.t("title", "Outstanding & Recovery Reports"),
      subtitle: s.t(`opt_${type}`, type),
      fileSlug: `outstanding-report-${type}`,
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
    a.download = `outstanding-report-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "Outstanding & Recovery Reports")}
      subtitle={s.t("subtitle", "Receivable, payable and aging analysis")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_outstanding", "Outstanding"),
          items: [
            { value: "all", label: s.t("opt_all", "All Outstanding") },
            { value: "receivable", label: s.t("opt_receivable", "Receivables") },
            { value: "payable", label: s.t("opt_payable", "Payables") },
            { value: "aging", label: s.t("opt_aging", "Aging Analysis") },
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
        subtitle: s.t("table_sub", "Live from the ledger outstanding engine"),
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
