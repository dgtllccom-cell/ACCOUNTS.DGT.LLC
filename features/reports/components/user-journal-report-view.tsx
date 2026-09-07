"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserCog, Activity, Globe2 } from "lucide-react";
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

type UserRow = {
  userId: string; userCode: string; fullName: string; email: string;
  countryId: string | null; countryName: string; branchId: string | null; branchName: string;
  branchCode: string; branchType: string; role: string; registrationDate: string;
  status: string; permissions: string[]; lastActivity: string | null;
  activityCounts: { logins: number; transactions: number; roznamcha: number; purchases: number; payments: number; accounts: number; approvals: number; edits: number };
};
type Payload = { summary: Record<string, number>; rows: UserRow[] };
type Row = Record<string, unknown>;

const EMPTY: ReportFilterState = { dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "" };
const num = (n: unknown) => (Number(n) || 0).toLocaleString("en-US");
const dt = (v: unknown) => { const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? String(v ?? "—") : d.toLocaleDateString("en-GB"); };

const TYPES = ["directory", "activity", "permissions"] as const;
type ReportType = (typeof TYPES)[number];

export function UserJournalReportView({
  context, countries,
}: { context: ReportContext; countries: ReportMetaOption[] }) {
  const s = useErpScreen("usrrep");
  const [type, setType] = useState<ReportType>("directory");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (applied.countryId) qs.set("countryId", applied.countryId);
      const r = await apiGet<Payload>(`/api/erp/users/journal-report${qs.toString() ? `?${qs}` : ""}`);
      setData(r);
    } catch {
      setData({ summary: {}, rows: [] });
    } finally {
      setLoading(false);
    }
  }, [applied]);
  useEffect(() => { void load(); }, [load]);

  const allRows = data?.rows ?? [];
  const summary = data?.summary ?? {};

  const rows: Row[] = useMemo(() => {
    let out = allRows;
    if (applied.countryId) out = out.filter((r) => String(r.countryId) === applied.countryId);
    return out.map((r) => {
      const ac = r.activityCounts ?? ({} as UserRow["activityCounts"]);
      const totalActivity = Object.values(ac).reduce((a, b) => a + (Number(b) || 0), 0);
      return {
        userCode: r.userCode || "—",
        fullName: r.fullName || "—",
        email: r.email && r.email !== "-" ? r.email : "—",
        role: (r.role || "—").replace(/_/g, " "),
        countryName: r.countryName || "—",
        branchName: r.branchName || "—",
        branchType: r.branchType || "—",
        status: r.status || "—",
        registrationDate: r.registrationDate,
        lastActivity: r.lastActivity,
        logins: ac.logins ?? 0,
        transactions: ac.transactions ?? 0,
        roznamcha: ac.roznamcha ?? 0,
        approvals: ac.approvals ?? 0,
        edits: ac.edits ?? 0,
        totalActivity,
        permissionCount: (r.permissions ?? []).length,
        permissions: (r.permissions ?? []).join(", ") || "—",
      };
    });
  }, [allRows, applied]);

  const columns = useMemo(() => {
    if (type === "activity") return [
      { key: "userCode", label: s.t("c_code", "User Code"), kind: "text" as const },
      { key: "fullName", label: s.t("c_name", "User Name"), kind: "text" as const },
      { key: "branchName", label: s.t("c_branch", "Branch"), kind: "text" as const },
      { key: "logins", label: s.t("c_logins", "Logins"), align: "end" as const, kind: "qty" as const },
      { key: "transactions", label: s.t("c_txn", "Transactions"), align: "end" as const, kind: "qty" as const },
      { key: "roznamcha", label: s.t("c_roz", "Roznamcha"), align: "end" as const, kind: "qty" as const },
      { key: "approvals", label: s.t("c_appr", "Approvals"), align: "end" as const, kind: "qty" as const },
      { key: "edits", label: s.t("c_edits", "Edits"), align: "end" as const, kind: "qty" as const },
      { key: "totalActivity", label: s.t("c_total_act", "Total Activity"), align: "end" as const, kind: "qty" as const },
      { key: "lastActivity", label: s.t("c_last", "Last Activity"), kind: "date" as const },
    ];
    if (type === "permissions") return [
      { key: "userCode", label: s.t("c_code", "User Code"), kind: "text" as const },
      { key: "fullName", label: s.t("c_name", "User Name"), kind: "text" as const },
      { key: "role", label: s.t("c_role", "Role"), kind: "text" as const },
      { key: "branchName", label: s.t("c_branch", "Branch"), kind: "text" as const },
      { key: "permissionCount", label: s.t("c_perm_count", "Permissions"), align: "end" as const, kind: "qty" as const },
      { key: "permissions", label: s.t("c_perm_list", "Permission Keys"), kind: "text" as const },
    ];
    return [
      { key: "userCode", label: s.t("c_code", "User Code"), kind: "text" as const },
      { key: "fullName", label: s.t("c_name", "User Name"), kind: "text" as const },
      { key: "email", label: s.t("c_email", "Email"), kind: "text" as const },
      { key: "role", label: s.t("c_role", "Role"), kind: "text" as const },
      { key: "countryName", label: s.t("c_country", "Country"), kind: "text" as const },
      { key: "branchName", label: s.t("c_branch", "Branch"), kind: "text" as const },
      { key: "branchType", label: s.t("c_branch_type", "Branch Type"), align: "center" as const, kind: "text" as const },
      { key: "status", label: s.t("c_status", "Status"), align: "center" as const, kind: "text" as const },
      { key: "registrationDate", label: s.t("c_reg", "Registered"), kind: "date" as const },
    ];
  }, [type, s]);

  const distinct = (k: string) => new Set(rows.map((r) => r[k]).filter(Boolean)).size;
  const sum = (k: string) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "summary",
      title: s.t("card_summary", "User Summary"),
      subtitle: s.t(`opt_${type}`, type),
      icon: <UserCog className="h-4 w-4" />,
      accent: "blue",
      rows: [
        { label: s.t("k_total", "Total Users"), value: Number(summary.totalUsers ?? rows.length), mono: true, tone: "strong" },
        { label: s.t("k_active", "Active Users"), value: Number(summary.activeUsers ?? rows.filter((r) => /active/i.test(String(r.status))).length), tone: "positive", mono: true },
        { label: s.t("k_admin", "Admin Users"), value: Number(summary.adminUsers ?? 0), mono: true },
        { label: s.t("k_recent", "Recent Logins"), value: Number(summary.recentLogins ?? 0), mono: true },
      ],
    },
    {
      key: "structure",
      title: s.t("card_structure", "Access Structure"),
      subtitle: s.t("card_structure_sub", "Country vs branch users (loaded rows)"),
      icon: <Activity className="h-4 w-4" />,
      accent: "purple",
      rows: [
        { label: s.t("b_country", "Country Users"), value: Number(summary.countryUsers ?? 0), mono: true },
        { label: s.t("b_branch", "Branch Users"), value: Number(summary.branchUsers ?? 0), mono: true },
        { label: s.t("b_roles", "Distinct Roles"), value: distinct("role"), mono: true },
        { label: s.t("b_activity", "Total Activity Events"), value: num(sum("totalActivity")), mono: true },
      ],
    },
    {
      key: "coverage",
      title: s.t("card_coverage", "Coverage"),
      subtitle: s.t("card_coverage_sub", "Countries & branches (loaded rows)"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("c_countries", "Countries"), value: distinct("countryName"), mono: true },
        { label: s.t("c_branches", "Branches"), value: distinct("branchName"), mono: true },
      ],
      footer: { label: s.t("c_report", "Active Report"), value: s.t(`opt_${type}`, type) },
    },
  ], [s, rows, summary, type]);

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
      title: s.t("title", "User Journal & Access Reports"),
      subtitle: s.t(`opt_${type}`, type),
      fileSlug: `user-journal-report-${type}`,
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
    a.download = `user-journal-report-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "User Journal & Access Reports")}
      subtitle={s.t("subtitle", "User directory, activity and permissions")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_users", "Users"),
          items: [
            { value: "directory", label: s.t("opt_directory", "User Directory") },
            { value: "activity", label: s.t("opt_activity", "User Activity Journal") },
            { value: "permissions", label: s.t("opt_permissions", "Roles & Permissions") },
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
        subtitle: s.t("table_sub", "Live from the user directory"),
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
