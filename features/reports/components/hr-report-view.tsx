"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users, ClipboardList, Globe2 } from "lucide-react";
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

type ApiCol = { key: string; label: string; align?: "left" | "right" | "center"; kind?: string };
type Payload = { columns: ApiCol[]; rows: Array<Record<string, unknown>> };

const EMPTY: ReportFilterState = { dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "" };
const num = (n: unknown) => (Number(n) || 0).toLocaleString("en-US");
const money = (n: unknown) => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TYPES = [
  "employee_directory", "attendance", "leave", "overtime", "payroll_register",
  "salary_slip", "employee_ledger", "expiring_documents", "gratuity", "audit_history",
] as const;
const MONEY_HINT = /salary|amount|allowance|deduction|gross|net|overtime|gratuity|advance|total/i;

export function HrReportView({
  context, countries,
}: { context: ReportContext; countries: ReportMetaOption[] }) {
  const s = useErpScreen("hrrep");
  const [type, setType] = useState<string>("employee_directory");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ type });
      if (applied.dateFrom) qs.set("fromDate", applied.dateFrom);
      if (applied.dateTo) qs.set("toDate", applied.dateTo);
      if (applied.countryId) qs.set("countryId", applied.countryId);
      const res = await apiGet<Payload>(`/api/erp/hr/reports?${qs.toString()}`);
      setData(res);
    } catch {
      setData({ columns: [], rows: [] });
    } finally {
      setLoading(false);
    }
  }, [type, applied]);
  useEffect(() => { void load(); }, [load]);

  const rows = data?.rows ?? [];
  const apiCols = data?.columns ?? [];

  const distinct = (k: string) => new Set(rows.map((r) => r[k]).filter(Boolean)).size;
  const sumKey = (k: string) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const moneyKeys = apiCols.filter((c) => c.kind === "money" || MONEY_HINT.test(c.key)).map((c) => c.key);

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "summary",
      title: s.t("card_summary", "HR Summary"),
      subtitle: s.t(`opt_${type}`, type.replace(/_/g, " ")),
      icon: <Users className="h-4 w-4" />,
      accent: "emerald",
      rows: [
        { label: s.t("k_rows", "Report Rows"), value: rows.length, mono: true, tone: "strong" },
        { label: s.t("k_employees", "Distinct Employees"), value: distinct("employee_code") || distinct("employee_name"), mono: true },
        ...(moneyKeys.slice(0, 3).map((k) => {
          const col = apiCols.find((c) => c.key === k);
          return { label: col?.label ?? k, value: money(sumKey(k)), mono: true };
        }) as ReportCard["rows"]),
      ],
      footer: moneyKeys[3] ? { label: apiCols.find((c) => c.key === moneyKeys[3])?.label ?? moneyKeys[3], value: money(sumKey(moneyKeys[3])), tone: "strong" } : undefined,
    },
    {
      key: "breakdown",
      title: s.t("card_breakdown", "Status & Category"),
      subtitle: s.t("card_breakdown_sub", "By status / department (loaded rows)"),
      icon: <ClipboardList className="h-4 w-4" />,
      accent: "purple",
      rows: [
        { label: s.t("b_departments", "Departments"), value: distinct("department"), mono: true },
        { label: s.t("b_designations", "Designations"), value: distinct("designation"), mono: true },
        { label: s.t("b_active", "Active / Present"), value: rows.filter((r) => /active|present|paid|approved/i.test(String(r.status ?? r.line_status ?? r.is_active ?? ""))).length, tone: "positive", mono: true },
        { label: s.t("b_inactive", "Inactive / Absent"), value: rows.filter((r) => /inactive|absent|pending|rejected|unpaid/i.test(String(r.status ?? r.line_status ?? ""))).length, tone: "muted", mono: true },
      ],
    },
    {
      key: "coverage",
      title: s.t("card_coverage", "Country / Branch Coverage"),
      subtitle: s.t("card_coverage_sub", "Where staff sit (loaded rows)"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("c_countries", "Countries"), value: distinct("country"), mono: true },
        { label: s.t("c_branches", "Branches"), value: distinct("city_branch") || distinct("branch"), mono: true },
        { label: s.t("c_periods", "Payroll Periods"), value: distinct("period_month"), mono: true },
      ],
      footer: { label: s.t("c_report", "Active Report"), value: s.t(`opt_${type}`, type.replace(/_/g, " ")) },
    },
  ], [s, rows, apiCols, type, moneyKeys]);

  const cellFmt = (c: ApiCol, v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (c.kind === "money" || (MONEY_HINT.test(c.key) && !Number.isNaN(Number(v)))) return money(v);
    if (c.kind === "qty") return num(v);
    if (c.kind === "date" || /date|_at$|month/i.test(c.key)) {
      const d = new Date(String(v));
      return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB");
    }
    return String(v);
  };

  const shellCols: ReportTableColumn[] = apiCols.map((c) => ({
    key: c.key, label: c.label,
    align: c.align === "right" || c.kind === "money" || MONEY_HINT.test(c.key) ? "end" : c.align === "center" ? "center" : "start",
    render: (r: Record<string, unknown>) => cellFmt(c, r[c.key]),
  }));

  const printInput = () => {
    const pdfCols: UrpColumn[] = apiCols.map((c) => ({
      key: c.key, label: c.label,
      align: c.align === "right" || c.kind === "money" || MONEY_HINT.test(c.key) ? "end" : c.align === "center" ? "center" : "start",
    }));
    const prows = rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const c of apiCols) o[c.key] = cellFmt(c, r[c.key]);
      return o;
    });
    const totals: Record<string, string | number> = {};
    for (const k of moneyKeys) totals[k] = money(sumKey(k));
    return {
      lang: s.lang,
      title: s.t("title", "HR & Employee Reports"),
      subtitle: s.t(`opt_${type}`, type.replace(/_/g, " ")),
      fileSlug: `hr-report-${type}`,
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
      table: { title: s.t(`opt_${type}`, type.replace(/_/g, " ")), columns: pdfCols, rows: prows, totals: Object.keys(totals).length ? totals : undefined },
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
    const head = apiCols.map((c) => c.label).join(",");
    const lines = rows.map((r) => apiCols.map((c) => `"${cellFmt(c, r[c.key]).replace(/"/g, "'")}"`).join(","));
    const blob = new Blob(["﻿" + [head, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hr-report-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "HR & Employee Reports")}
      subtitle={s.t("subtitle", "Directory, attendance, payroll and documents")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_people", "People"),
          items: [
            { value: "employee_directory", label: s.t("opt_employee_directory", "Employee Directory") },
            { value: "expiring_documents", label: s.t("opt_expiring_documents", "Expiring Documents") },
            { value: "audit_history", label: s.t("opt_audit_history", "HR Audit History") },
          ],
        },
        {
          label: s.t("grp_time", "Time & Attendance"),
          items: [
            { value: "attendance", label: s.t("opt_attendance", "Attendance Report") },
            { value: "leave", label: s.t("opt_leave", "Leave Report") },
            { value: "overtime", label: s.t("opt_overtime", "Overtime Report") },
          ],
        },
        {
          label: s.t("grp_pay", "Payroll"),
          items: [
            { value: "payroll_register", label: s.t("opt_payroll_register", "Payroll Register") },
            { value: "salary_slip", label: s.t("opt_salary_slip", "Salary Slips") },
            { value: "employee_ledger", label: s.t("opt_employee_ledger", "Employee Ledger") },
            { value: "gratuity", label: s.t("opt_gratuity", "Gratuity Report") },
          ],
        },
      ]}
      selectedReport={type}
      onSelectReport={(v) => { if ((TYPES as readonly string[]).includes(v)) setType(v); }}
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
        title: s.t(`opt_${type}`, type.replace(/_/g, " ")),
        subtitle: s.t("table_sub", "Live from the HR module"),
        columns: shellCols.length ? shellCols : [{ key: "_", label: "—", align: "start" }],
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
