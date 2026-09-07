"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Users2, Globe2 } from "lucide-react";
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
const num = (n: unknown) => (Number(n) || 0).toLocaleString("en-US");

const TYPES = ["countries", "main_branches", "city_branches"] as const;
type ReportType = (typeof TYPES)[number];

export function BranchOrgReportView({
  context, countries,
}: { context: ReportContext; countries: ReportMetaOption[] }) {
  const s = useErpScreen("orgrep");
  const [type, setType] = useState<ReportType>("countries");
  const [data, setData] = useState<Any>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<Any>(`/api/branch-management/general-report`);
      setData(r ?? {});
    } catch {
      setData({});
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const countriesArr = (Array.isArray(data.countries) ? data.countries : []) as Any[];
  const summary = (data.summary ?? {}) as Record<string, number>;

  const rows: Row[] = useMemo(() => {
    let cs = countriesArr;
    if (applied.countryId) cs = cs.filter((c) => String(c.id) === applied.countryId);

    if (type === "countries") {
      return cs.map((c) => ({
        country: c.name, iso2: c.iso2, currency: c.currencyCode,
        mainBranches: Array.isArray(c.mainBranches) ? (c.mainBranches as unknown[]).length : c.mainBranches,
        users: c.totalUsersCount ?? c.users, mainUsers: c.mainUsersCount,
        status: c.isActive ? s.t("v_active", "Active") : s.t("v_inactive", "Inactive"),
      }));
    }
    // flatten main / city branches
    const out: Row[] = [];
    for (const c of cs) {
      const mbs = (Array.isArray(c.mainBranches) ? c.mainBranches : []) as Any[];
      for (const mb of mbs) {
        if (type === "main_branches") {
          out.push({
            country: c.name, mainBranch: mb.name, code: mb.code ?? mb.branchCode,
            cityBranches: Array.isArray(mb.cityBranches) ? (mb.cityBranches as unknown[]).length : mb.cityBranches,
            users: mb.usersCount ?? (Array.isArray(mb.users) ? (mb.users as unknown[]).length : mb.users),
            status: (mb.isActive ?? true) ? s.t("v_active", "Active") : s.t("v_inactive", "Inactive"),
          });
        } else {
          const cbs = (Array.isArray(mb.cityBranches) ? mb.cityBranches : []) as Any[];
          for (const cb of cbs) {
            out.push({
              country: c.name, mainBranch: mb.name, cityBranch: cb.name, code: cb.code ?? cb.branchCode,
              type: cb.branchType ?? cb.type,
              users: cb.usersCount ?? (Array.isArray(cb.users) ? (cb.users as unknown[]).length : cb.users),
              status: (cb.isActive ?? true) ? s.t("v_active", "Active") : s.t("v_inactive", "Inactive"),
            });
          }
        }
      }
    }
    return out;
  }, [countriesArr, type, applied, s]);

  const columns = useMemo(() => {
    if (type === "countries") return [
      { key: "country", label: s.t("c_country", "Country"), kind: "text" as const },
      { key: "iso2", label: s.t("c_iso", "ISO"), align: "center" as const, kind: "text" as const },
      { key: "currency", label: s.t("c_currency", "Currency"), align: "center" as const, kind: "text" as const },
      { key: "mainBranches", label: s.t("c_mains", "Main Branches"), align: "end" as const, kind: "qty" as const },
      { key: "users", label: s.t("c_users", "Users"), align: "end" as const, kind: "qty" as const },
      { key: "mainUsers", label: s.t("c_main_users", "Main-Branch Users"), align: "end" as const, kind: "qty" as const },
      { key: "status", label: s.t("c_status", "Status"), align: "center" as const, kind: "text" as const },
    ];
    if (type === "main_branches") return [
      { key: "country", label: s.t("c_country", "Country"), kind: "text" as const },
      { key: "mainBranch", label: s.t("c_main", "Main Branch"), kind: "text" as const },
      { key: "code", label: s.t("c_code", "Code"), kind: "text" as const },
      { key: "cityBranches", label: s.t("c_cities", "City Branches"), align: "end" as const, kind: "qty" as const },
      { key: "users", label: s.t("c_users", "Users"), align: "end" as const, kind: "qty" as const },
      { key: "status", label: s.t("c_status", "Status"), align: "center" as const, kind: "text" as const },
    ];
    return [
      { key: "country", label: s.t("c_country", "Country"), kind: "text" as const },
      { key: "mainBranch", label: s.t("c_main", "Main Branch"), kind: "text" as const },
      { key: "cityBranch", label: s.t("c_city", "City Branch"), kind: "text" as const },
      { key: "code", label: s.t("c_code", "Code"), kind: "text" as const },
      { key: "type", label: s.t("c_type", "Type"), align: "center" as const, kind: "text" as const },
      { key: "users", label: s.t("c_users", "Users"), align: "end" as const, kind: "qty" as const },
      { key: "status", label: s.t("c_status", "Status"), align: "center" as const, kind: "text" as const },
    ];
  }, [type, s]);

  const sum = (k: string) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const distinct = (k: string) => new Set(rows.map((r) => r[k]).filter(Boolean)).size;

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "summary",
      title: s.t("card_summary", "Organisation Summary"),
      subtitle: s.t(`opt_${type}`, type),
      icon: <Building2 className="h-4 w-4" />,
      accent: "blue",
      rows: [
        { label: s.t("k_countries", "Countries"), value: num(summary.totalCountries ?? distinct("country")), mono: true, tone: "strong" },
        { label: s.t("k_mains", "Main Branches"), value: num(summary.totalMainBranches ?? 0), mono: true },
        { label: s.t("k_cities", "City Branches"), value: num(summary.totalCityBranches ?? 0), mono: true },
        { label: s.t("k_active_branches", "Active Branches"), value: num(summary.totalActiveBranches ?? 0), tone: "positive", mono: true },
      ],
    },
    {
      key: "people",
      title: s.t("card_people", "People & Accounts"),
      subtitle: s.t("card_people_sub", "Org-wide totals"),
      icon: <Users2 className="h-4 w-4" />,
      accent: "purple",
      rows: [
        { label: s.t("b_users", "Active Users"), value: num(summary.totalActiveUsers ?? 0), mono: true },
        { label: s.t("b_accounts", "Main Accounts"), value: num(summary.totalMainAccounts ?? 0), mono: true },
        { label: s.t("b_inactive", "Inactive Branches"), value: num(summary.totalInactiveBranches ?? 0), tone: "muted", mono: true },
      ],
    },
    {
      key: "coverage",
      title: s.t("card_coverage", "Loaded Rows"),
      subtitle: s.t("card_coverage_sub", "For the selected view"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("c_rows", "Rows"), value: rows.length, mono: true },
        { label: s.t("c_users_loaded", "Users (loaded)"), value: num(sum("users")), mono: true },
      ],
      footer: { label: s.t("c_report", "Active Report"), value: s.t(`opt_${type}`, type) },
    },
  ], [s, rows, summary, type]);

  const fmt = (c: (typeof columns)[number], v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (c.kind === "qty") return num(v);
    return String(v);
  };

  const shellCols: ReportTableColumn[] = columns.map((c) => ({
    key: c.key, label: c.label, align: c.align ?? "start",
    render: (r: Row) => fmt(c, r[c.key]),
  }));

  const footerRow: Row = {};
  columns.forEach((c, i) => { footerRow[c.key] = c.kind === "qty" ? sum(c.key) : i === 0 ? s.t("row_total", "Total") : ""; });

  const printInput = () => {
    const pdfCols: UrpColumn[] = columns.map((c) => ({ key: c.key, label: c.label, align: c.align ?? "start" }));
    const prows = rows.map((r) => {
      const o: Row = {};
      for (const c of columns) o[c.key] = fmt(c, r[c.key]);
      return o;
    });
    return {
      lang: s.lang,
      title: s.t("title", "Branch & Organisation Reports"),
      subtitle: s.t(`opt_${type}`, type),
      fileSlug: `branch-org-report-${type}`,
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
    a.download = `branch-org-report-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "Branch & Organisation Reports")}
      subtitle={s.t("subtitle", "Countries, main branches and city branches")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_org", "Organisation"),
          items: [
            { value: "countries", label: s.t("opt_countries", "Countries") },
            { value: "main_branches", label: s.t("opt_main_branches", "Main Branches") },
            { value: "city_branches", label: s.t("opt_city_branches", "City Branches") },
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
        subtitle: s.t("table_sub", "Live from the branch-management general report"),
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
