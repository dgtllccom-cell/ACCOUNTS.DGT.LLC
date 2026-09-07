"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ship, Container, Globe2 } from "lucide-react";
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
const money = (n: unknown) => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dt = (v: unknown) => { const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? String(v ?? "—") : d.toLocaleDateString("en-GB"); };
const s2 = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

const TYPES = ["bl_records", "line_records", "clearing_orders"] as const;
type ReportType = (typeof TYPES)[number];

export function ShippingClearingReportView({
  context, countries,
}: { context: ReportContext; countries: ReportMetaOption[] }) {
  const s = useErpScreen("shprep");
  const [type, setType] = useState<ReportType>("bl_records");
  const [raw, setRaw] = useState<Any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY);

  const countryName = useMemo(() => new Map(countries.map((c) => [c.id, c.name])), [countries]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (type === "bl_records") {
        const r = await apiGet<{ records: Any[] }>(`/api/erp/shipping/bl-records`);
        setRaw(Array.isArray(r?.records) ? r.records : []);
      } else if (type === "line_records") {
        const r = await apiGet<{ shippingLineRecords: Any[] }>(`/api/erp/shipping/line-records`);
        setRaw(Array.isArray(r?.shippingLineRecords) ? r.shippingLineRecords : []);
      } else {
        const r = await apiGet<{ data: Any[] }>(`/api/erp/clearing-agent/customer-order`);
        setRaw(Array.isArray((r as Any)?.data) ? ((r as Any).data as Any[]) : Array.isArray(r) ? (r as Any[]) : []);
      }
    } catch {
      setRaw([]);
    } finally {
      setLoading(false);
    }
  }, [type]);
  useEffect(() => { void load(); }, [load]);

  const resolveCountry = (r: Any) =>
    (r.countries as Any)?.name ??
    (r.country_id ? countryName.get(String(r.country_id)) : null) ??
    r.loading_country_name ??
    "—";

  const rows: Row[] = useMemo(() => {
    let src = raw;
    if (applied.countryId) {
      src = src.filter((r) =>
        String(r.country_id) === applied.countryId ||
        String(r.loading_country_id) === applied.countryId ||
        String(r.receiving_country_id) === applied.countryId);
    }
    if (type === "bl_records") return src.map((r) => ({
      bl_number: r.bl_number, container_number: r.container_number,
      shipping_line_name: r.shipping_line_name, vessel_name: r.vessel_name, voyage_number: r.voyage_number,
      loading_port: r.loading_port, discharge_port: r.discharge_port,
      country: resolveCountry(r), currency_code: r.currency_code,
      debit: r.debit, credit: r.credit,
      shipment_status: r.shipment_status, etd: r.etd, eta: r.eta,
    }));
    if (type === "line_records") return src.map((r) => ({
      shipping_reference_no: r.shipping_reference_no ?? r.manual_reference_number,
      shipping_line_name: r.shipping_line_name, vessel_name: r.vessel_name, voyage_number: r.voyage_number,
      container_numbers: Array.isArray(r.container_numbers) ? (r.container_numbers as unknown[]).join(", ") : r.container_numbers,
      port_of_loading: r.port_of_loading, port_of_discharge: r.port_of_discharge,
      country: resolveCountry(r),
      workflow_state: r.workflow_state ?? r.shipment_status, etd: r.etd, eta: r.eta,
    }));
    return src.map((r) => ({
      order_no: r.order_no, customer_name: r.customer_name ?? r.importer_name ?? r.buyer_name,
      shipment_type: r.shipment_type, transport_mode: r.transport_mode, movement_type: r.movement_type,
      loading_country_name: r.loading_country_name, receiving_country_name: r.receiving_country_name,
      loading_port_name: r.loading_port_name, destination_port_name: r.destination_port_name,
      goods_name: r.goods_name, truck_number: r.truck_number,
      status: r.status, expected_loading_date: r.expected_loading_date,
    }));
  }, [raw, type, applied, countryName]);

  const columns: Array<{ key: string; label: string; align?: "start" | "center" | "end"; kind?: "money" | "qty" | "date" | "text" }> = useMemo(() => {
    if (type === "bl_records") return [
      { key: "bl_number", label: s.t("c_bl", "BL Number"), kind: "text" },
      { key: "container_number", label: s.t("c_container", "Container"), kind: "text" },
      { key: "shipping_line_name", label: s.t("c_line", "Shipping Line"), kind: "text" },
      { key: "vessel_name", label: s.t("c_vessel", "Vessel"), kind: "text" },
      { key: "voyage_number", label: s.t("c_voyage", "Voyage"), align: "center", kind: "text" },
      { key: "loading_port", label: s.t("c_pol", "Load Port"), kind: "text" },
      { key: "discharge_port", label: s.t("c_pod", "Discharge Port"), kind: "text" },
      { key: "country", label: s.t("c_country", "Country"), kind: "text" },
      { key: "debit", label: s.t("c_debit", "Debit"), align: "end", kind: "money" },
      { key: "credit", label: s.t("c_credit", "Credit"), align: "end", kind: "money" },
      { key: "shipment_status", label: s.t("c_status", "Status"), align: "center", kind: "text" },
      { key: "etd", label: s.t("c_etd", "ETD"), kind: "date" },
      { key: "eta", label: s.t("c_eta", "ETA"), kind: "date" },
    ];
    if (type === "line_records") return [
      { key: "shipping_reference_no", label: s.t("c_ref", "Reference"), kind: "text" },
      { key: "shipping_line_name", label: s.t("c_line", "Shipping Line"), kind: "text" },
      { key: "vessel_name", label: s.t("c_vessel", "Vessel"), kind: "text" },
      { key: "voyage_number", label: s.t("c_voyage", "Voyage"), align: "center", kind: "text" },
      { key: "container_numbers", label: s.t("c_containers", "Containers"), kind: "text" },
      { key: "port_of_loading", label: s.t("c_pol", "Load Port"), kind: "text" },
      { key: "port_of_discharge", label: s.t("c_pod", "Discharge Port"), kind: "text" },
      { key: "country", label: s.t("c_country", "Country"), kind: "text" },
      { key: "workflow_state", label: s.t("c_status", "Status"), align: "center", kind: "text" },
      { key: "etd", label: s.t("c_etd", "ETD"), kind: "date" },
      { key: "eta", label: s.t("c_eta", "ETA"), kind: "date" },
    ];
    return [
      { key: "order_no", label: s.t("c_order", "Order No"), kind: "text" },
      { key: "customer_name", label: s.t("c_customer", "Customer / Importer"), kind: "text" },
      { key: "shipment_type", label: s.t("c_shipment_type", "Shipment"), align: "center", kind: "text" },
      { key: "transport_mode", label: s.t("c_transport", "Transport"), align: "center", kind: "text" },
      { key: "movement_type", label: s.t("c_movement", "Movement"), align: "center", kind: "text" },
      { key: "loading_country_name", label: s.t("c_load_country", "Load Country"), kind: "text" },
      { key: "receiving_country_name", label: s.t("c_recv_country", "Receiving Country"), kind: "text" },
      { key: "loading_port_name", label: s.t("c_pol", "Load Port"), kind: "text" },
      { key: "destination_port_name", label: s.t("c_dest_port", "Destination Port"), kind: "text" },
      { key: "goods_name", label: s.t("c_goods", "Goods"), kind: "text" },
      { key: "truck_number", label: s.t("c_truck", "Truck"), kind: "text" },
      { key: "status", label: s.t("c_status", "Status"), align: "center", kind: "text" },
      { key: "expected_loading_date", label: s.t("c_load_date", "Expected Loading"), kind: "date" },
    ];
  }, [type, s]);

  const distinct = (k: string) => new Set(rows.map((r) => r[k]).filter(Boolean)).size;
  const sum = (k: string) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "summary",
      title: s.t("card_summary", "Shipment Summary"),
      subtitle: s.t(`opt_${type}`, type),
      icon: <Ship className="h-4 w-4" />,
      accent: "blue",
      rows: [
        { label: s.t("k_rows", "Shipments"), value: rows.length, mono: true, tone: "strong" },
        { label: s.t("k_lines", "Shipping Lines"), value: distinct("shipping_line_name"), mono: true },
        ...(type === "bl_records"
          ? ([
              { label: s.t("k_debit", "Total Debit"), value: money(sum("debit")), mono: true, tone: "negative" as const },
              { label: s.t("k_credit", "Total Credit"), value: money(sum("credit")), mono: true, tone: "positive" as const },
            ] as ReportCard["rows"])
          : ([{ label: s.t("k_containers", "Containers / Trucks"), value: rows.filter((r) => r.container_numbers || r.container_number || r.truck_number).length, mono: true }] as ReportCard["rows"])),
      ],
    },
    {
      key: "status",
      title: s.t("card_status", "Status Breakdown"),
      subtitle: s.t("card_status_sub", "By shipment status (loaded rows)"),
      icon: <Container className="h-4 w-4" />,
      accent: "purple",
      rows: [
        { label: s.t("b_intransit", "In Transit / Active"), value: rows.filter((r) => /transit|active|sail|load/i.test(String(r.shipment_status ?? r.workflow_state ?? r.status))).length, mono: true },
        { label: s.t("b_arrived", "Arrived / Completed"), value: rows.filter((r) => /arriv|complet|deliver|clear/i.test(String(r.shipment_status ?? r.workflow_state ?? r.status))).length, tone: "positive", mono: true },
        { label: s.t("b_draft", "Draft / Pending"), value: rows.filter((r) => /draft|pending|new/i.test(String(r.shipment_status ?? r.workflow_state ?? r.status))).length, tone: "muted", mono: true },
      ],
    },
    {
      key: "coverage",
      title: s.t("card_coverage", "Route Coverage"),
      subtitle: s.t("card_coverage_sub", "Ports & countries (loaded rows)"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("c_countries", "Countries"), value: distinct("country") || distinct("loading_country_name"), mono: true },
        { label: s.t("c_load_ports", "Load Ports"), value: distinct("loading_port") || distinct("port_of_loading") || distinct("loading_port_name"), mono: true },
        { label: s.t("c_disc_ports", "Discharge Ports"), value: distinct("discharge_port") || distinct("port_of_discharge") || distinct("destination_port_name"), mono: true },
      ],
      footer: { label: s.t("c_report", "Active Report"), value: s.t(`opt_${type}`, type) },
    },
  ], [s, rows, type]);

  const fmt = (c: (typeof columns)[number], v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (c.kind === "money") return money(v);
    if (c.kind === "qty") return num(v);
    if (c.kind === "date") return dt(v);
    return s2(v);
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
    for (const c of columns) if (c.kind === "money") totals[c.key] = money(sum(c.key));
    return {
      lang: s.lang,
      title: s.t("title", "Shipping & Clearing Reports"),
      subtitle: s.t(`opt_${type}`, type),
      fileSlug: `shipping-clearing-report-${type}`,
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
    a.download = `shipping-clearing-report-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "Shipping & Clearing Reports")}
      subtitle={s.t("subtitle", "Bills of lading, shipping lines and clearing orders")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_shipping", "Shipping & Clearing"),
          items: [
            { value: "bl_records", label: s.t("opt_bl_records", "Bill of Lading Records") },
            { value: "line_records", label: s.t("opt_line_records", "Shipping Line Records") },
            { value: "clearing_orders", label: s.t("opt_clearing_orders", "Clearing Orders") },
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
        subtitle: s.t("table_sub", "Live from the shipping & clearing modules"),
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
