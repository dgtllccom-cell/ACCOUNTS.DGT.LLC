"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, AlertTriangle, Globe2 } from "lucide-react";
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

type KycItem = {
  id: string; name: string; code: string; type: string; typeLabel: string; countryName: string;
  email: string; phone: string; status: string; statusBadge: string; missingRequirements: string[];
  createdAt: string; graceTotalDays: number; daysRemaining: number; progressPercent: number;
  ownerName: string; documentsCount: number;
};
type Row = Record<string, unknown>;

const EMPTY: ReportFilterState = { dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "" };
const num = (n: unknown) => (Number(n) || 0).toLocaleString("en-US");
const dt = (v: unknown) => { const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? String(v ?? "—") : d.toLocaleDateString("en-GB"); };

const TYPES = ["all", "pending", "verified", "missing_docs"] as const;
type ReportType = (typeof TYPES)[number];

export function KycReportView({
  context, countries,
}: { context: ReportContext; countries: ReportMetaOption[] }) {
  const s = useErpScreen("kycrep");
  const [type, setType] = useState<ReportType>("all");
  const [raw, setRaw] = useState<KycItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<{ items: KycItem[] }>(`/api/erp/kyc/reports`);
      setRaw(Array.isArray(r?.items) ? r.items : []);
    } catch {
      setRaw([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const isVerified = (i: KycItem) => /verified|active|approved|complete/i.test(i.status) && !/suspend|pending|overdue/i.test(i.status);
  const isPending = (i: KycItem) => /pending|grace|review/i.test(i.status) || /pending/i.test(i.statusBadge);

  const rows: Row[] = useMemo(() => {
    let out = raw;
    if (type === "verified") out = out.filter(isVerified);
    if (type === "pending") out = out.filter(isPending);
    if (type === "missing_docs") out = out.filter((i) => (i.missingRequirements?.length ?? 0) > 0 || (i.documentsCount ?? 0) === 0);
    if (applied.countryId) {
      const cn = countries.find((c) => c.id === applied.countryId)?.name;
      if (cn) out = out.filter((i) => i.countryName === cn);
    }
    return out.map((i) => ({
      name: i.name,
      code: i.code,
      typeLabel: i.typeLabel,
      countryName: i.countryName || "—",
      ownerName: i.ownerName || "—",
      phone: i.phone || "—",
      status: i.statusBadge || i.status,
      progressPercent: i.progressPercent,
      daysRemaining: i.daysRemaining,
      documentsCount: i.documentsCount,
      missing: (i.missingRequirements ?? []).join("; ") || "—",
      createdAt: i.createdAt,
    }));
  }, [raw, type, applied, countries]);

  const columns: Array<{ key: string; label: string; align?: "start" | "center" | "end"; kind?: "qty" | "date" | "text" }> = [
    { key: "name", label: s.t("c_entity", "Entity"), kind: "text" },
    { key: "code", label: s.t("c_code", "Code"), kind: "text" },
    { key: "typeLabel", label: s.t("c_type", "Type"), kind: "text" },
    { key: "countryName", label: s.t("c_country", "Country"), kind: "text" },
    { key: "ownerName", label: s.t("c_owner", "Owner"), kind: "text" },
    { key: "status", label: s.t("c_status", "KYC Status"), align: "center", kind: "text" },
    { key: "progressPercent", label: s.t("c_progress", "Progress %"), align: "end", kind: "qty" },
    { key: "documentsCount", label: s.t("c_docs", "Documents"), align: "end", kind: "qty" },
    { key: "daysRemaining", label: s.t("c_days", "Grace Days Left"), align: "end", kind: "qty" },
    { key: "missing", label: s.t("c_missing", "Missing Requirements"), kind: "text" },
  ];

  const distinct = (k: string) => new Set(rows.map((r) => r[k]).filter(Boolean)).size;

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "summary",
      title: s.t("card_summary", "KYC Summary"),
      subtitle: s.t(`opt_${type}`, type),
      icon: <ShieldCheck className="h-4 w-4" />,
      accent: "emerald",
      rows: [
        { label: s.t("k_rows", "Entities"), value: rows.length, mono: true, tone: "strong" },
        { label: s.t("k_verified", "Verified"), value: raw.filter(isVerified).length, tone: "positive", mono: true },
        { label: s.t("k_pending", "Pending / Grace"), value: raw.filter(isPending).length, tone: "muted", mono: true },
        { label: s.t("k_missing", "With Missing Docs"), value: raw.filter((i) => (i.missingRequirements?.length ?? 0) > 0).length, tone: "negative", mono: true },
      ],
    },
    {
      key: "risk",
      title: s.t("card_risk", "Compliance Risk"),
      subtitle: s.t("card_risk_sub", "Grace period and documents (loaded rows)"),
      icon: <AlertTriangle className="h-4 w-4" />,
      accent: "rose",
      rows: [
        { label: s.t("b_overdue", "Grace Overdue"), value: rows.filter((r) => Number(r.daysRemaining) <= 0).length, tone: "negative", mono: true },
        { label: s.t("b_nodocs", "No Documents"), value: rows.filter((r) => Number(r.documentsCount) === 0).length, tone: "muted", mono: true },
        { label: s.t("b_complete", "100% Progress"), value: rows.filter((r) => Number(r.progressPercent) >= 100).length, tone: "positive", mono: true },
      ],
    },
    {
      key: "coverage",
      title: s.t("card_coverage", "Coverage"),
      subtitle: s.t("card_coverage_sub", "Countries & entity types (loaded rows)"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("c_countries", "Countries"), value: distinct("countryName"), mono: true },
        { label: s.t("c_types", "Entity Types"), value: distinct("typeLabel"), mono: true },
      ],
      footer: { label: s.t("c_report", "Active Report"), value: s.t(`opt_${type}`, type) },
    },
  ], [s, rows, raw, type]);

  const fmt = (c: (typeof columns)[number], v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
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
    return {
      lang: s.lang,
      title: s.t("title", "KYC & Compliance Reports"),
      subtitle: s.t(`opt_${type}`, type),
      fileSlug: `kyc-report-${type}`,
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
    a.download = `kyc-report-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "KYC & Compliance Reports")}
      subtitle={s.t("subtitle", "Branch KYC status, grace periods and document gaps")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_kyc", "KYC & Compliance"),
          items: [
            { value: "all", label: s.t("opt_all", "All Entities") },
            { value: "pending", label: s.t("opt_pending", "Pending / Grace Period") },
            { value: "verified", label: s.t("opt_verified", "Verified") },
            { value: "missing_docs", label: s.t("opt_missing_docs", "Missing Documents") },
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
        subtitle: s.t("table_sub", "Live from the KYC compliance engine"),
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
