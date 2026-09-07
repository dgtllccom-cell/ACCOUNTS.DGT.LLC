"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TrendingUp, History, Globe2 } from "lucide-react";
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

type Rate = {
  id: string; country_id: string | null; rate_date: string; rate_time: string | null;
  effective_from: string | null; superseded_at: string | null; currency_code: string;
  buying_rate: number | string; selling_rate: number | string; credit_rate: number | string; debit_rate: number | string;
  user_name: string | null; branch_name: string | null;
};

type Col = { key: string; label: string; align?: "start" | "center" | "end"; kind?: "rate" | "date" | "text" };
type Row = Record<string, unknown>;

const EMPTY: ReportFilterState = { dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "" };
const rate = (n: unknown) => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const dt = (v: unknown) => { const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? String(v ?? "—") : d.toLocaleDateString("en-GB"); };

const TYPES = ["current", "history"] as const;
type ReportType = (typeof TYPES)[number];

export function ExchangeRateReportView({
  context, countries,
}: { context: ReportContext; countries: ReportMetaOption[] }) {
  const s = useErpScreen("fxrep");
  const [type, setType] = useState<ReportType>("current");
  const [raw, setRaw] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY);

  const countryName = useMemo(() => new Map(countries.map((c) => [c.id, c.name])), [countries]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<Rate[]>(`/api/erp/currency/daily-rates`);
      setRaw(Array.isArray(r) ? r : []);
    } catch {
      setRaw([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const rows: Row[] = useMemo(() => {
    let out = raw;
    if (type === "current") out = out.filter((r) => !r.superseded_at);
    if (applied.countryId) out = out.filter((r) => String(r.country_id) === applied.countryId);
    if (applied.dateFrom) out = out.filter((r) => String(r.rate_date) >= applied.dateFrom);
    if (applied.dateTo) out = out.filter((r) => String(r.rate_date) <= applied.dateTo);
    return out.map((r) => ({
      rate_date: r.rate_date,
      rate_time: r.rate_time || "—",
      country: r.country_id ? (countryName.get(r.country_id) ?? "—") : "—",
      currency_code: r.currency_code,
      buying_rate: r.buying_rate,
      selling_rate: r.selling_rate,
      credit_rate: r.credit_rate,
      debit_rate: r.debit_rate,
      branch_name: r.branch_name || "—",
      user_name: r.user_name || "—",
      state: r.superseded_at ? s.t("v_superseded", "Superseded") : s.t("v_active", "Active"),
    }));
  }, [raw, type, applied, countryName, s]);

  const columns: Col[] = [
    { key: "rate_date", label: s.t("c_date", "Rate Date"), kind: "date" },
    { key: "rate_time", label: s.t("c_time", "Time"), align: "center", kind: "text" },
    { key: "country", label: s.t("c_country", "Country"), kind: "text" },
    { key: "currency_code", label: s.t("c_currency", "Currency"), align: "center", kind: "text" },
    { key: "buying_rate", label: s.t("c_buying", "Buying"), align: "end", kind: "rate" },
    { key: "selling_rate", label: s.t("c_selling", "Selling"), align: "end", kind: "rate" },
    { key: "credit_rate", label: s.t("c_credit", "Credit"), align: "end", kind: "rate" },
    { key: "debit_rate", label: s.t("c_debit", "Debit"), align: "end", kind: "rate" },
    { key: "branch_name", label: s.t("c_branch", "Branch"), kind: "text" },
    { key: "user_name", label: s.t("c_user", "Entered By"), kind: "text" },
    { key: "state", label: s.t("c_state", "State"), align: "center", kind: "text" },
  ];

  const distinct = (k: string) => new Set(rows.map((r) => r[k]).filter(Boolean)).size;
  const avg = (k: string) => (rows.length ? rows.reduce((a, r) => a + (Number(r[k]) || 0), 0) / rows.length : 0);

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "summary",
      title: s.t("card_summary", "Rate Summary"),
      subtitle: s.t(`opt_${type}`, type),
      icon: <TrendingUp className="h-4 w-4" />,
      accent: "emerald",
      rows: [
        { label: s.t("k_rows", "Rate Entries"), value: rows.length, mono: true, tone: "strong" },
        { label: s.t("k_currencies", "Currencies"), value: distinct("currency_code"), mono: true },
        { label: s.t("k_avg_buy", "Avg Buying"), value: rate(avg("buying_rate")), mono: true },
        { label: s.t("k_avg_sell", "Avg Selling"), value: rate(avg("selling_rate")), mono: true },
      ],
    },
    {
      key: "state",
      title: s.t("card_state", "Rate State"),
      subtitle: s.t("card_state_sub", "Active vs superseded (loaded rows)"),
      icon: <History className="h-4 w-4" />,
      accent: "purple",
      rows: [
        { label: s.t("b_active", "Active"), value: rows.filter((r) => r.state === s.t("v_active", "Active")).length, tone: "positive", mono: true },
        { label: s.t("b_superseded", "Superseded"), value: rows.filter((r) => r.state === s.t("v_superseded", "Superseded")).length, tone: "muted", mono: true },
      ],
    },
    {
      key: "coverage",
      title: s.t("card_coverage", "Coverage"),
      subtitle: s.t("card_coverage_sub", "Countries & branches (loaded rows)"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("c_countries", "Countries"), value: distinct("country"), mono: true },
        { label: s.t("c_branches", "Branches"), value: distinct("branch_name"), mono: true },
      ],
      footer: { label: s.t("c_report", "Active Report"), value: s.t(`opt_${type}`, type) },
    },
  ], [s, rows, type]);

  const fmt = (c: Col, v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (c.kind === "rate") return rate(v);
    if (c.kind === "date") return dt(v);
    return String(v);
  };

  const shellCols: ReportTableColumn[] = columns.map((c) => ({
    key: c.key, label: c.label, align: c.align ?? "start",
    render: (r: Row) => fmt(c, r[c.key]),
  }));

  const printInput = () => {
    const pdfCols: UrpColumn[] = columns.map((c) => ({ key: c.key, label: c.label, align: c.align ?? "start" }));
    const prows = rows.map((r) => {
      const o: Row = {};
      for (const c of columns) o[c.key] = fmt(c, r[c.key]);
      return o;
    });
    return {
      lang: s.lang,
      title: s.t("title", "Exchange Rate Reports"),
      subtitle: s.t(`opt_${type}`, type),
      fileSlug: `exchange-rate-report-${type}`,
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
      table: { title: s.t(`opt_${type}`, type), columns: pdfCols, rows: prows },
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
    a.download = `exchange-rate-report-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "Exchange Rate Reports")}
      subtitle={s.t("subtitle", "Daily USD rates, history and coverage")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_rates", "Exchange Rates"),
          items: [
            { value: "current", label: s.t("opt_current", "Current Rates") },
            { value: "history", label: s.t("opt_history", "Rate History") },
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
        subtitle: s.t("table_sub", "Live from the daily-rate architecture"),
        columns: shellCols,
        rows,
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
