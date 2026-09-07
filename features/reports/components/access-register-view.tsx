"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, Users, Globe2 } from "lucide-react";
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

type AccessRow = {
  id: string; country: string; mainBranch: string; cityBranch: string;
  responsiblePerson: string; role: string; username: string; email: string;
  status: string; assignedPermissions: string; lastUpdated: string;
};

const EMPTY: ReportFilterState = { dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "" };

export function AccessRegisterView({ context }: { context: ReportContext }) {
  const s = useErpScreen("accreg");
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState("access-register");
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ rows: AccessRow[] }>("/api/erp/reports/access-register");
      setRows(res.rows ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // client-side filter (real data; the source route returns the full scoped set)
  const view = useMemo(() => {
    let r = rows;
    if (applied.status) r = r.filter((x) => x.status.toLowerCase() === applied.status.toLowerCase());
    if (applied.countryId) r = r.filter((x) => x.country === applied.countryId);
    return r;
  }, [rows, applied]);

  const byRole = (role: string) => view.filter((r) => r.role === role).length;
  const byStatus = (st: string) => view.filter((r) => r.status.toLowerCase() === st).length;

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "summary",
      title: s.t("card_summary", "Access Summary"),
      subtitle: s.t("card_summary_sub", "User accounts in this register"),
      icon: <ShieldCheck className="h-4 w-4" />,
      accent: "emerald",
      rows: [
        { label: s.t("s_total", "Total Users"), value: view.length, mono: true, tone: "strong" },
        { label: s.t("s_active", "Active"), value: byStatus("active"), tone: "positive", mono: true },
        { label: s.t("s_inactive", "Inactive"), value: byStatus("inactive"), tone: "muted", mono: true },
        { label: s.t("s_suspended", "Suspended"), value: byStatus("suspended"), tone: "negative", mono: true },
      ],
      footer: { label: s.t("s_with_email", "With Email On File"), value: view.filter((r) => r.email).length },
    },
    {
      key: "roles",
      title: s.t("card_roles", "Role Breakdown"),
      subtitle: s.t("card_roles_sub", "Assignments by role"),
      icon: <Users className="h-4 w-4" />,
      accent: "purple",
      rows: [
        { label: s.t("r_super", "Super Admin"), value: byRole("Super Admin"), mono: true },
        { label: s.t("r_country", "Country Admin"), value: byRole("Country Admin"), mono: true },
        { label: s.t("r_main", "Main Branch Admin"), value: byRole("Main Branch Admin"), mono: true },
        { label: s.t("r_city", "City Branch User"), value: byRole("City Branch User"), mono: true },
        { label: s.t("r_agent", "Clearing Agent"), value: byRole("Clearing Agent"), mono: true },
        { label: s.t("r_acct", "Accountant / Auditor"), value: byRole("Accountant") + byRole("Auditor"), mono: true },
      ],
    },
    {
      key: "coverage",
      title: s.t("card_coverage", "Country / Branch Coverage"),
      subtitle: s.t("card_coverage_sub", "Where accounts exist"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("c_countries", "Countries"), value: new Set(view.map((r) => r.country).filter((x) => x && x !== "—")).size, mono: true },
        { label: s.t("c_main", "Main Branches"), value: new Set(view.map((r) => r.mainBranch).filter((x) => x && x !== "—")).size, mono: true },
        { label: s.t("c_city", "City Branches"), value: new Set(view.map((r) => r.cityBranch).filter((x) => x && x !== "—")).size, mono: true },
        { label: s.t("c_roles", "Distinct Roles"), value: new Set(view.map((r) => r.role)).size, mono: true },
      ],
      footer: { label: s.t("c_updated", "Most Recent Update"), value: view.map((r) => r.lastUpdated).sort().reverse()[0] || "—" },
    },
  ], [s, view]);

  const statusLabel = (st: string) => {
    const m: Record<string, string> = {
      Active: s.t("st_active", "Active"), Inactive: s.t("st_inactive", "Inactive"), Suspended: s.t("st_suspended", "Suspended"),
    };
    return m[st] ?? st;
  };

  const cols = [
    { key: "country", label: s.t("col_country", "Country"), align: "start" as const },
    { key: "mainBranch", label: s.t("col_main_branch", "Main Branch"), align: "start" as const },
    { key: "cityBranch", label: s.t("col_city_branch", "City Branch"), align: "start" as const },
    { key: "responsiblePerson", label: s.t("col_person", "Responsible Person"), align: "start" as const },
    { key: "role", label: s.t("col_role", "Role"), align: "start" as const },
    { key: "username", label: s.t("col_username", "Username"), align: "start" as const },
    { key: "email", label: s.t("col_email", "Email"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.email || "—") },
    { key: "status", label: s.t("col_status", "Status"), align: "center" as const, render: (r: Record<string, unknown>) => statusLabel(String(r.status)) },
    { key: "lastUpdated", label: s.t("col_updated", "Last Updated"), align: "start" as const },
  ];

  const printInput = () => {
    const pdfCols: UrpColumn[] = cols.map((c) => ({ key: c.key === "status" ? "statusLabel" : c.key, label: c.label, align: c.align }));
    const prows = view.map((r) => ({ ...r, statusLabel: statusLabel(r.status), email: r.email || "—" }));
    return {
      lang: s.lang,
      title: s.t("title", "Access Registration Report"),
      subtitle: s.t("subtitle", "Branch logins, roles and responsible persons"),
      fileSlug: "access-registration-report",
      orientation: "landscape" as const,
      branchUser: {
        country: context.country, state: context.state, city: context.city,
        branchName: context.branchName, branchCode: context.branchCode,
        userId: context.userId, userName: context.userName, role: context.role,
        accessScope: context.accessScope, dateTime: new Date().toLocaleString("en-GB"), online: context.online,
      },
      cards: cards.map((c) => ({ title: c.title, subtitle: c.subtitle, rows: c.rows.map((r) => ({ ...r })), footer: c.footer })),
      appliedFilters: [
        applied.status ? { label: s.tGlobal("urs.f_status", "Status"), value: statusLabel(applied.status) } : null,
        applied.countryId ? { label: s.tGlobal("urs.f_country", "Country"), value: applied.countryId } : null,
      ].filter(Boolean) as Array<{ label: string; value: string }>,
      table: { title: s.t("table_title", "Access Register Entries"), columns: pdfCols, rows: prows },
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
    const lines = view.map((r) => [r.country, r.mainBranch, r.cityBranch, `"${r.responsiblePerson}"`, r.role, r.username, r.email || "—", statusLabel(r.status), r.lastUpdated].join(","));
    const blob = new Blob(["﻿" + [head, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `access-registration-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const countryOpts: ReportMetaOption[] = useMemo(
    () => [...new Set(rows.map((r) => r.country).filter((x) => x && x !== "—"))].map((c) => ({ id: c, name: c })),
    [rows],
  );

  return (
    <UniversalReportShell
      title={s.t("title", "Access Registration Report")}
      subtitle={s.t("subtitle", "Branch logins, roles and responsible persons")}
      locationLine={context.scopeLabel || context.accessScope}
      bannerImage={context.bannerImage}
      scopeBadge={s.t("scope_super", "Super Admin Only")}
      reportGroups={[
        {
          label: s.t("grp_access", "Access & Security"),
          items: [
            { value: "access-register", label: s.t("opt_access_register", "Access Registration Report") },
            { value: "active-only", label: s.t("opt_active_only", "Active Accounts Only") },
            { value: "by-role", label: s.t("opt_by_role", "Accounts by Role") },
          ],
        },
      ]}
      selectedReport={selectedReport}
      onSelectReport={setSelectedReport}
      filters={filters}
      onFiltersChange={setFilters}
      onApplyFilters={() => setApplied(filters)}
      filterOptions={{
        countries: countryOpts, states: [], cities: [], branches: [],
        statuses: [
          { value: "active", label: s.t("st_active", "Active") },
          { value: "inactive", label: s.t("st_inactive", "Inactive") },
          { value: "suspended", label: s.t("st_suspended", "Suspended") },
        ],
      }}
      showFilters={{ dateFrom: false, stateId: false, cityId: false, branchId: false }}
      branchUser={{
        country: context.country, state: context.state, city: context.city,
        branchName: context.branchName, branchCode: context.branchCode,
        userId: context.userId.slice(0, 18), userName: context.userName, role: context.role,
        accessScope: context.accessScope, dateTime: new Date().toLocaleString("en-GB"), online: context.online,
      }}
      cards={cards}
      table={{
        title: s.t("table_title", "Access Register Entries"),
        subtitle: s.t("table_sub", "Every branch login and its responsible person"),
        columns: cols,
        rows: view as unknown as Array<Record<string, unknown>>,
        totalCount: view.length,
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
