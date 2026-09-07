"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Scale, AlertTriangle, CalendarClock } from "lucide-react";
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

type Col = { key: string; label: string; align?: "start" | "center" | "end"; kind?: "money" | "qty" | "text" | "date" };
type Row = Record<string, unknown>;

const EMPTY: ReportFilterState = { dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "" };
const num = (n: unknown) => (Number(n) || 0).toLocaleString("en-US");
const money = (n: unknown) => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dt = (v: unknown) => { const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? String(v ?? "—") : d.toLocaleDateString("en-GB"); };

const TYPES = ["daily", "entries", "exceptions"] as const;
type ReportType = (typeof TYPES)[number];

export function SettlementReportView({
  context, countries,
}: { context: ReportContext; countries: ReportMetaOption[] }) {
  const s = useErpScreen("setrep");
  const [type, setType] = useState<ReportType>("daily");
  const [raw, setRaw] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (type === "daily") {
        const r = await apiGet<Row[]>(`/api/erp/settlement/daily`);
        setRaw(Array.isArray(r) ? r : []);
      } else if (type === "exceptions") {
        const r = await apiGet<Row[]>(`/api/erp/settlement/exceptions`);
        setRaw(Array.isArray(r) ? r : []);
      } else {
        const r = await apiGet<{ items: Row[] }>(`/api/erp/settlement?pageSize=1000`);
        setRaw(Array.isArray(r?.items) ? r.items : []);
      }
    } catch {
      setRaw([]);
    } finally {
      setLoading(false);
    }
  }, [type]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    let out = raw;
    if (applied.countryId) out = out.filter((r) => String(r.country_id) === applied.countryId);
    if (applied.dateFrom) out = out.filter((r) => String(r.txn_date ?? r.source_date ?? "") >= applied.dateFrom);
    if (applied.dateTo) out = out.filter((r) => String(r.txn_date ?? r.source_date ?? "") <= applied.dateTo + "T23:59:59");
    return out;
  }, [raw, applied]);

  const columns: Col[] = useMemo(() => {
    if (type === "daily") return [
      { key: "country_name", label: s.t("c_country", "Country"), kind: "text" },
      { key: "branch_name", label: s.t("c_branch", "Branch"), kind: "text" },
      { key: "txn_date", label: s.t("c_date", "Date"), kind: "date" },
      { key: "local_currency", label: s.t("c_currency", "Currency"), align: "center", kind: "text" },
      { key: "total_cr_local", label: s.t("c_cr_local", "CR (Local)"), align: "end", kind: "money" },
      { key: "total_dr_local", label: s.t("c_dr_local", "DR (Local)"), align: "end", kind: "money" },
      { key: "total_cr_usd", label: s.t("c_cr_usd", "CR (USD)"), align: "end", kind: "money" },
      { key: "total_dr_usd", label: s.t("c_dr_usd", "DR (USD)"), align: "end", kind: "money" },
      { key: "remaining_cr_local", label: s.t("c_rem_cr", "Remaining CR"), align: "end", kind: "money" },
    ];
    if (type === "exceptions") return [
      { key: "source_reference_no", label: s.t("c_ref", "Reference"), kind: "text" },
      { key: "source_module", label: s.t("c_module", "Module"), kind: "text" },
      { key: "source_date", label: s.t("c_date", "Date"), kind: "date" },
      { key: "direction", label: s.t("c_dir", "Dir"), align: "center", kind: "text" },
      { key: "local_currency", label: s.t("c_currency", "Currency"), align: "center", kind: "text" },
      { key: "local_amount", label: s.t("c_local_amt", "Local Amount"), align: "end", kind: "money" },
      { key: "original_usd_amount", label: s.t("c_usd_amt", "USD Amount"), align: "end", kind: "money" },
      { key: "settlement_status", label: s.t("c_status", "Status"), align: "center", kind: "text" },
    ];
    return [
      { key: "source_reference_no", label: s.t("c_ref", "Reference"), kind: "text" },
      { key: "source_module", label: s.t("c_module", "Module"), kind: "text" },
      { key: "source_date", label: s.t("c_date", "Date"), kind: "date" },
      { key: "direction", label: s.t("c_dir", "Dir"), align: "center", kind: "text" },
      { key: "local_currency", label: s.t("c_currency", "Currency"), align: "center", kind: "text" },
      { key: "local_amount", label: s.t("c_local_amt", "Local Amount"), align: "end", kind: "money" },
      { key: "original_usd_amount", label: s.t("c_usd_amt", "USD Amount"), align: "end", kind: "money" },
      { key: "remaining_local", label: s.t("c_rem_local", "Remaining (Local)"), align: "end", kind: "money" },
      { key: "settlement_status", label: s.t("c_status", "Status"), align: "center", kind: "text" },
    ];
  }, [type, s]);

  const sumKey = (k: string) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const distinct = (k: string) => new Set(rows.map((r) => r[k]).filter(Boolean)).size;

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => {
    const crLocalKey = type === "daily" ? "total_cr_local" : "local_amount";
    const usdKey = type === "daily" ? "total_cr_usd" : "original_usd_amount";
    return [
      {
        key: "summary",
        title: s.t("card_summary", "Settlement Summary"),
        subtitle: s.t(`opt_${type}`, type),
        icon: <Scale className="h-4 w-4" />,
        accent: "blue",
        rows: [
          { label: s.t("k_rows", "Report Rows"), value: rows.length, mono: true, tone: "strong" },
          { label: s.t("k_cr_local", "Total CR / Amount (Local)"), value: money(sumKey(crLocalKey)), mono: true },
          { label: s.t("k_dr_local", "Total DR (Local)"), value: money(sumKey("total_dr_local")), mono: true },
        ],
        footer: { label: s.t("k_usd", "Total (USD)"), value: money(sumKey(usdKey)), tone: "strong" },
      },
      {
        key: "status",
        title: s.t("card_status", "Status Breakdown"),
        subtitle: s.t("card_status_sub", "By settlement status"),
        icon: <AlertTriangle className="h-4 w-4" />,
        accent: "rose",
        rows: [
          { label: s.t("b_settled", "Settled"), value: rows.filter((r) => /settled/i.test(String(r.settlement_status)) && !/unsettled/i.test(String(r.settlement_status))).length, tone: "positive", mono: true },
          { label: s.t("b_partial", "Partial"), value: rows.filter((r) => /partial/i.test(String(r.settlement_status))).length, mono: true },
          { label: s.t("b_unsettled", "Unsettled"), value: rows.filter((r) => /unsettled/i.test(String(r.settlement_status))).length, tone: "negative", mono: true },
          { label: s.t("b_flagged", "Flagged"), value: rows.filter((r) => /flag/i.test(String(r.settlement_status)) || r.is_flagged === true).length, tone: "muted", mono: true },
        ],
      },
      {
        key: "coverage",
        title: s.t("card_coverage", "Coverage"),
        subtitle: s.t("card_coverage_sub", "Countries & currencies (loaded rows)"),
        icon: <CalendarClock className="h-4 w-4" />,
        accent: "orange",
        rows: [
          { label: s.t("c_countries", "Countries"), value: distinct("country_name") || distinct("country_id"), mono: true },
          { label: s.t("c_currencies", "Currencies"), value: distinct("local_currency"), mono: true },
          { label: s.t("c_modules", "Source Modules"), value: distinct("source_module"), mono: true },
        ],
        footer: { label: s.t("c_report", "Active Report"), value: s.t(`opt_${type}`, type) },
      },
    ];
  }, [s, rows, type]);

  const fmt = (c: Col, v: unknown) => {
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

  const printInput = () => {
    const pdfCols: UrpColumn[] = columns.map((c) => ({ key: c.key, label: c.label, align: c.align ?? "start" }));
    const prows = rows.map((r) => {
      const o: Row = {};
      for (const c of columns) o[c.key] = fmt(c, r[c.key]);
      return o;
    });
    const totals: Record<string, string | number> = {};
    for (const c of columns) if (c.kind === "money") totals[c.key] = money(sumKey(c.key));
    return {
      lang: s.lang,
      title: s.t("title", "Settlement Reports"),
      subtitle: s.t(`opt_${type}`, type),
      fileSlug: `settlement-report-${type}`,
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
    a.download = `settlement-report-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const footerRow: Row = {};
  columns.forEach((c, i) => { footerRow[c.key] = c.kind === "money" ? sumKey(c.key) : i === 0 ? s.t("row_total", "Total") : ""; });

  return (
    <UniversalReportShell
      title={s.t("title", "Settlement Reports")}
      subtitle={s.t("subtitle", "Daily settlement, entries and FX exceptions")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_settlement", "Settlement"),
          items: [
            { value: "daily", label: s.t("opt_daily", "Daily Settlement") },
            { value: "entries", label: s.t("opt_entries", "Settlement Entries") },
            { value: "exceptions", label: s.t("opt_exceptions", "FX / Settlement Exceptions") },
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
        subtitle: s.t("table_sub", "Live from the settlement engine"),
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
