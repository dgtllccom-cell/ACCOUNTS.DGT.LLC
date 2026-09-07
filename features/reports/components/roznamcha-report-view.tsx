"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollText, ClipboardList, Globe2 } from "lucide-react";
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

type Line = { debit: number | null; credit: number | null; currency: string | null; payment_entry_type: string | null };
type Entry = {
  id: string; entry_category: string | null; source_module: string | null;
  journal_no: string | null; voucher_no: string | null; entry_date: string | null;
  narration: string | null; status: string | null; created_by: string | null;
  countries: { name?: string } | null;
  country_branches: { name?: string } | null;
  city_branches: { name?: string } | null;
  profiles: { full_name?: string } | null;
  roznamcha_lines: Line[];
};
type Payload = {
  entries: Entry[]; totalCount: number; totalDebit: number; totalCredit: number;
  netBalance: number; postedCount: number; pendingCount: number;
};

const EMPTY: ReportFilterState = { dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "" };
const money = (n: unknown) => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DEBIT_TYPES = new Set(["cash_receipt", "bank_deposit", "debit"]);
const lineAmt = (l: Line) => Number(l.debit || l.credit || 0);
const isDr = (l: Line) => DEBIT_TYPES.has(String(l.payment_entry_type ?? ""));

function categoryOf(e: Entry): "cash" | "invoice" | "transfer" | "bank" | "business" {
  const cat = e.entry_category ?? "";
  const mod = e.source_module ?? "";
  if (cat === "cash" || mod === "cash_entry") return "cash";
  if (cat === "invoice" || mod === "purchase" || mod === "local_purchase") return "invoice";
  if (cat === "transfer" || /transfer/i.test(e.source_module ?? "")) return "transfer";
  if (cat === "bank") return "bank";
  return "business";
}

export function RoznamchaReportView({
  context, countries,
}: { context: ReportContext; countries: ReportMetaOption[] }) {
  const s = useErpScreen("rozrep");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState("roznamcha-all");
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ entryCategory: "all", page: "1", pageSize: "50" });
      if (applied.dateFrom) qs.set("fromDate", applied.dateFrom);
      if (applied.dateTo) qs.set("toDate", applied.dateTo);
      if (applied.countryId) qs.set("countryId", applied.countryId);
      if (applied.status) qs.set("status", applied.status);
      const res = await apiGet<Payload>(`/api/erp/roznamcha/reports?${qs.toString()}`);
      setData(res);
    } catch {
      setData({ entries: [], totalCount: 0, totalDebit: 0, totalCredit: 0, netBalance: 0, postedCount: 0, pendingCount: 0 });
    } finally {
      setLoading(false);
    }
  }, [applied]);
  useEffect(() => { void load(); }, [load]);

  const entries = data?.entries ?? [];
  const catCount = (c: string) => entries.filter((e) => categoryOf(e) === c).length;

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "summary",
      title: s.t("card_summary", "Cash & Journal Summary"),
      subtitle: s.t("card_summary_sub", "Roznamcha totals in this scope"),
      icon: <ScrollText className="h-4 w-4" />,
      accent: "emerald",
      rows: [
        { label: s.t("f_entries", "Total Entries"), value: data?.totalCount ?? entries.length, mono: true, tone: "strong" },
        { label: s.t("f_debit", "Total Debit"), value: money(data?.totalDebit), tone: "negative", mono: true },
        { label: s.t("f_credit", "Total Credit"), value: money(data?.totalCredit), tone: "positive", mono: true },
        { label: s.t("f_posted", "Posted / Transferred"), value: data?.postedCount ?? 0, tone: "positive", mono: true },
        { label: s.t("f_pending", "Pending"), value: data?.pendingCount ?? 0, tone: "muted", mono: true },
      ],
      footer: { label: s.t("f_net", "Net Balance"), value: money(data?.netBalance), tone: "strong" },
    },
    {
      key: "category",
      title: s.t("card_category", "Category Breakdown"),
      subtitle: s.t("card_category_sub", "By entry type (loaded page)"),
      icon: <ClipboardList className="h-4 w-4" />,
      accent: "purple",
      rows: [
        { label: s.t("c_cash", "Cash Book"), value: catCount("cash"), mono: true },
        { label: s.t("c_invoice", "Invoice / Bill"), value: catCount("invoice"), mono: true },
        { label: s.t("c_transfer", "Transfer"), value: catCount("transfer"), mono: true },
        { label: s.t("c_bank", "Bank"), value: catCount("bank"), mono: true },
        { label: s.t("c_business", "Business / General"), value: catCount("business"), mono: true },
      ],
    },
    {
      key: "coverage",
      title: s.t("card_coverage", "Country / Branch Coverage"),
      subtitle: s.t("card_coverage_sub", "Where entries were booked (loaded page)"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("g_countries", "Countries"), value: new Set(entries.map((e) => e.countries?.name).filter(Boolean)).size, mono: true },
        { label: s.t("g_branches", "Branches"), value: new Set(entries.map((e) => e.city_branches?.name || e.country_branches?.name).filter(Boolean)).size, mono: true },
        { label: s.t("g_users", "Users"), value: new Set(entries.map((e) => e.profiles?.full_name).filter(Boolean)).size, mono: true },
      ],
      footer: { label: s.t("g_loaded", "Rows Loaded"), value: entries.length },
    },
  ], [s, data, entries]);

  const statusLabel = (st: string | null) => {
    const m: Record<string, string> = {
      posted: s.t("st_posted", "Posted"), transferred: s.t("st_transferred", "Transferred"),
      cancelled: s.t("st_cancelled", "Cancelled"), pending: s.t("st_pending", "Pending"),
    };
    return m[st ?? ""] ?? (st ?? "—");
  };
  const drOf = (e: Entry) => e.roznamcha_lines.filter(isDr).reduce((a, l) => a + lineAmt(l), 0);
  const crOf = (e: Entry) => e.roznamcha_lines.filter((l) => !isDr(l)).reduce((a, l) => a + lineAmt(l), 0);

  const cols = [
    { key: "voucher_no", label: s.t("col_voucher", "Voucher No"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.voucher_no || r.journal_no || "—") },
    { key: "entry_date", label: s.t("col_date", "Date"), align: "start" as const, render: (r: Record<string, unknown>) => r.entry_date ? new Date(String(r.entry_date)).toLocaleDateString("en-GB") : "—" },
    { key: "country", label: s.t("col_country", "Country"), align: "start" as const, render: (r: Record<string, unknown>) => (r.countries as any)?.name || "—" },
    { key: "branch", label: s.t("col_branch", "Branch"), align: "start" as const, render: (r: Record<string, unknown>) => (r.city_branches as any)?.name || (r.country_branches as any)?.name || "—" },
    { key: "narration", label: s.t("col_narration", "Narration"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.narration || "—") },
    { key: "dr", label: s.t("col_debit", "Debit"), align: "end" as const, render: (r: Record<string, unknown>) => money(drOf(r as unknown as Entry)) },
    { key: "cr", label: s.t("col_credit", "Credit"), align: "end" as const, render: (r: Record<string, unknown>) => money(crOf(r as unknown as Entry)) },
    { key: "status", label: s.t("col_status", "Status"), align: "center" as const, render: (r: Record<string, unknown>) => statusLabel(String(r.status ?? "")) },
    { key: "created_by_name", label: s.t("col_by", "Created By"), align: "start" as const, render: (r: Record<string, unknown>) => (r.profiles as any)?.full_name || "—" },
  ];

  const printInput = () => {
    const pdfCols: UrpColumn[] = [
      { key: "voucher", label: s.t("col_voucher", "Voucher No") },
      { key: "date", label: s.t("col_date", "Date"), format: "date" },
      { key: "country", label: s.t("col_country", "Country") },
      { key: "branch", label: s.t("col_branch", "Branch") },
      { key: "narration", label: s.t("col_narration", "Narration") },
      { key: "dr", label: s.t("col_debit", "Debit"), align: "end", format: "currency" },
      { key: "cr", label: s.t("col_credit", "Credit"), align: "end", format: "currency" },
      { key: "statusLabel", label: s.t("col_status", "Status"), align: "center" },
      { key: "by", label: s.t("col_by", "Created By") },
    ];
    const prows = entries.map((e) => ({
      voucher: e.voucher_no || e.journal_no || "—",
      date: e.entry_date ? new Date(e.entry_date).toLocaleDateString("en-GB") : "",
      country: e.countries?.name || "—",
      branch: e.city_branches?.name || e.country_branches?.name || "—",
      narration: e.narration || "—",
      dr: drOf(e), cr: crOf(e),
      statusLabel: statusLabel(e.status),
      by: e.profiles?.full_name || "—",
    }));
    return {
      lang: s.lang,
      title: s.t("title", "Roznamcha / Cash Report"),
      subtitle: s.t("subtitle", "Every cash and journal entry"),
      fileSlug: "roznamcha-cash-report",
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
        applied.status ? { label: s.tGlobal("urs.f_status", "Status"), value: statusLabel(applied.status) } : null,
      ].filter(Boolean) as Array<{ label: string; value: string }>,
      table: {
        title: s.t("table_title", "Roznamcha Entries"),
        columns: pdfCols,
        rows: prows,
        totals: { dr: prows.reduce((a, r) => a + r.dr, 0), cr: prows.reduce((a, r) => a + r.cr, 0) },
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
    const lines = entries.map((e) => [e.voucher_no || e.journal_no || "—", e.entry_date ? new Date(e.entry_date).toLocaleDateString("en-GB") : "", e.countries?.name || "—", e.city_branches?.name || e.country_branches?.name || "—", `"${(e.narration || "—").replace(/"/g, "'")}"`, money(drOf(e)), money(crOf(e)), statusLabel(e.status), e.profiles?.full_name || "—"].join(","));
    const blob = new Blob(["﻿" + [head, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `roznamcha-cash-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "Roznamcha / Cash Report")}
      subtitle={s.t("subtitle", "Every cash and journal entry")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_roz", "Roznamcha Reports"),
          items: [
            { value: "roznamcha-all", label: s.t("opt_all", "All Roznamcha Entries") },
            { value: "roznamcha-cash", label: s.t("opt_cash", "Cash Book Report") },
            { value: "roznamcha-transfer", label: s.t("opt_transfer", "Transfer Report") },
            { value: "roznamcha-bank", label: s.t("opt_bank", "Bank Report") },
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
          { value: "posted", label: s.t("st_posted", "Posted") },
          { value: "transferred", label: s.t("st_transferred", "Transferred") },
          { value: "cancelled", label: s.t("st_cancelled", "Cancelled") },
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
        title: s.t("table_title", "Roznamcha Entries"),
        subtitle: s.t("table_sub", "Voucher-level cash & journal detail"),
        columns: cols,
        rows: entries as unknown as Array<Record<string, unknown>>,
        totalCount: data?.totalCount ?? entries.length,
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
