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
} from "./universal-report-shell";
import { openUniversalReport, type UrpColumn } from "@/lib/reports/universal-report-print";

type Customer = {
  id: string; customer_name: string | null; person_code: string | null;
  company_name: string | null; contact_person: string | null;
  mobile: string | null; email: string | null; address: string | null;
  is_active: boolean | null;
  country_name: string | null; state_province_name: string | null; city_name: string | null;
};
type Payload = { customers: Customer[] };

const EMPTY: ReportFilterState = { dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "" };

export function CustomerReportView({
  context, countries,
}: { context: ReportContext; countries: ReportMetaOption[] }) {
  const s = useErpScreen("custrep");
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState("customer-directory");
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "500" });
      if (applied.countryId) qs.set("countryId", applied.countryId);
      const res = await apiGet<Payload>(`/api/erp/customers?${qs.toString()}`);
      setRows(res.customers ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [applied]);
  useEffect(() => { void load(); }, [load]);

  const view = useMemo(() => {
    let r = rows;
    if (applied.status === "active") r = r.filter((x) => x.is_active !== false);
    if (applied.status === "inactive") r = r.filter((x) => x.is_active === false);
    return r;
  }, [rows, applied.status]);

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "summary",
      title: s.t("card_summary", "Customer Summary"),
      subtitle: s.t("card_summary_sub", "Customer master in this scope"),
      icon: <Users className="h-4 w-4" />,
      accent: "emerald",
      rows: [
        { label: s.t("k_total", "Total Customers"), value: view.length, mono: true, tone: "strong" },
        { label: s.t("k_active", "Active"), value: view.filter((x) => x.is_active !== false).length, tone: "positive", mono: true },
        { label: s.t("k_inactive", "Inactive"), value: view.filter((x) => x.is_active === false).length, tone: "muted", mono: true },
        { label: s.t("k_company", "With Company"), value: view.filter((x) => x.company_name).length, mono: true },
        { label: s.t("k_email", "With Email"), value: view.filter((x) => x.email).length, mono: true },
      ],
      footer: { label: s.t("k_mobile", "With Mobile"), value: view.filter((x) => x.mobile).length },
    },
    {
      key: "contact",
      title: s.t("card_contact", "Contactability"),
      subtitle: s.t("card_contact_sub", "How reachable the customer base is"),
      icon: <ClipboardList className="h-4 w-4" />,
      accent: "purple",
      rows: [
        { label: s.t("c_full", "Full Contact (mobile + email)"), value: view.filter((x) => x.mobile && x.email).length, tone: "positive", mono: true },
        { label: s.t("c_phone_only", "Phone Only"), value: view.filter((x) => x.mobile && !x.email).length, mono: true },
        { label: s.t("c_email_only", "Email Only"), value: view.filter((x) => !x.mobile && x.email).length, mono: true },
        { label: s.t("c_none", "No Contact"), value: view.filter((x) => !x.mobile && !x.email).length, tone: "negative", mono: true },
        { label: s.t("c_address", "With Address"), value: view.filter((x) => x.address).length, mono: true },
      ],
    },
    {
      key: "coverage",
      title: s.t("card_coverage", "Country / City Coverage"),
      subtitle: s.t("card_coverage_sub", "Where customers are located"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("g_countries", "Countries"), value: new Set(view.map((x) => x.country_name).filter(Boolean)).size, mono: true },
        { label: s.t("g_states", "States / Provinces"), value: new Set(view.map((x) => x.state_province_name).filter(Boolean)).size, mono: true },
        { label: s.t("g_cities", "Cities"), value: new Set(view.map((x) => x.city_name).filter(Boolean)).size, mono: true },
        { label: s.t("g_companies", "Distinct Companies"), value: new Set(view.map((x) => x.company_name).filter(Boolean)).size, mono: true },
      ],
      footer: { label: s.t("g_coded", "With Person Code"), value: view.filter((x) => x.person_code).length },
    },
  ], [s, view]);

  const statusLabel = (a: boolean | null) => (a === false ? s.t("st_inactive", "Inactive") : s.t("st_active", "Active"));

  const cols = [
    { key: "customer_name", label: s.t("col_name", "Customer Name"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.customer_name || "—") },
    { key: "person_code", label: s.t("col_code", "Code"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.person_code || "—") },
    { key: "company_name", label: s.t("col_company", "Company"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.company_name || "—") },
    { key: "contact_person", label: s.t("col_contact", "Contact Person"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.contact_person || "—") },
    { key: "mobile", label: s.t("col_mobile", "Mobile"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.mobile || "—") },
    { key: "email", label: s.t("col_email", "Email"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.email || "—") },
    { key: "country_name", label: s.t("col_country", "Country"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.country_name || "—") },
    { key: "city_name", label: s.t("col_city", "City"), align: "start" as const, render: (r: Record<string, unknown>) => String(r.city_name || "—") },
    { key: "is_active", label: s.t("col_status", "Status"), align: "center" as const, render: (r: Record<string, unknown>) => statusLabel(r.is_active as boolean | null) },
  ];

  const printInput = () => {
    const pdfCols: UrpColumn[] = [
      { key: "customer_name", label: s.t("col_name", "Customer Name") },
      { key: "person_code", label: s.t("col_code", "Code") },
      { key: "company_name", label: s.t("col_company", "Company") },
      { key: "contact_person", label: s.t("col_contact", "Contact Person") },
      { key: "mobile", label: s.t("col_mobile", "Mobile") },
      { key: "email", label: s.t("col_email", "Email") },
      { key: "country_name", label: s.t("col_country", "Country") },
      { key: "city_name", label: s.t("col_city", "City") },
      { key: "statusLabel", label: s.t("col_status", "Status"), align: "center" },
    ];
    const prows = view.map((r) => ({
      customer_name: r.customer_name || "—", person_code: r.person_code || "—",
      company_name: r.company_name || "—", contact_person: r.contact_person || "—",
      mobile: r.mobile || "—", email: r.email || "—",
      country_name: r.country_name || "—", city_name: r.city_name || "—",
      statusLabel: statusLabel(r.is_active),
    }));
    return {
      lang: s.lang,
      title: s.t("title", "Customer Report"),
      subtitle: s.t("subtitle", "Customer directory, contactability and coverage"),
      fileSlug: "customer-report",
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
        applied.status ? { label: s.tGlobal("urs.f_status", "Status"), value: statusLabel(applied.status === "active") } : null,
      ].filter(Boolean) as Array<{ label: string; value: string }>,
      table: { title: s.t("table_title", "Customer Directory"), columns: pdfCols, rows: prows },
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
    const lines = view.map((r) => [`"${r.customer_name || "—"}"`, r.person_code || "—", `"${r.company_name || "—"}"`, `"${r.contact_person || "—"}"`, r.mobile || "—", r.email || "—", r.country_name || "—", r.city_name || "—", statusLabel(r.is_active)].join(","));
    const blob = new Blob(["﻿" + [head, ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `customer-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "Customer Report")}
      subtitle={s.t("subtitle", "Customer directory, contactability and coverage")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_customer", "Customer Reports"),
          items: [
            { value: "customer-directory", label: s.t("opt_directory", "Customer Directory") },
            { value: "customer-active", label: s.t("opt_active", "Active Customers") },
            { value: "customer-by-country", label: s.t("opt_by_country", "Customers by Country") },
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
          { value: "active", label: s.t("st_active", "Active") },
          { value: "inactive", label: s.t("st_inactive", "Inactive") },
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
        title: s.t("table_title", "Customer Directory"),
        subtitle: s.t("table_sub", "Every customer with contact and location"),
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
