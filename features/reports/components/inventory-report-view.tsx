"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Layers, Globe2 } from "lucide-react";
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
type Payload = { columns: ApiCol[]; rows: Array<Record<string, unknown>>; totals?: Record<string, unknown>; functionalCurrency?: string };

const EMPTY: ReportFilterState = { dateFrom: "", dateTo: "", countryId: "", stateId: "", cityId: "", branchId: "", status: "" };
const num = (n: unknown) => (Number(n) || 0).toLocaleString("en-US");
const money = (n: unknown) => (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TYPES = [
  "stock_on_hand", "stock_valuation", "low_stock", "warehouse_wise",
  "country_wise", "goods_wise", "stock_movements",
] as const;

export function InventoryReportView({
  context, countries,
}: { context: ReportContext; countries: ReportMetaOption[] }) {
  const s = useErpScreen("invrep");
  const [type, setType] = useState<string>("stock_on_hand");
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilterState>(EMPTY);
  const [applied, setApplied] = useState<ReportFilterState>(EMPTY);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ report: type });
      if (applied.dateFrom) qs.set("from", applied.dateFrom);
      if (applied.dateTo) qs.set("to", applied.dateTo);
      if (applied.countryId) qs.set("countryId", applied.countryId);
      const res = await apiGet<Payload>(`/api/erp/inventory/reports?${qs.toString()}`);
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
  const totals = data?.totals ?? {};
  const fc = data?.functionalCurrency ?? "USD";

  const distinct = (k: string) => new Set(rows.map((r) => r[k]).filter(Boolean)).size;
  const sumKey = (k: string) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const moneyKeys = apiCols.filter((c) => c.kind === "money").map((c) => c.key);
  const qtyKeys = apiCols.filter((c) => c.kind === "qty").map((c) => c.key);

  const cards: [ReportCard, ReportCard, ReportCard] = useMemo(() => [
    {
      key: "summary",
      title: s.t("card_summary", "Stock Summary"),
      subtitle: s.t(`opt_${type}`, type.replace(/_/g, " ")),
      icon: <Boxes className="h-4 w-4" />,
      accent: "blue",
      rows: [
        { label: s.t("k_rows", "Report Rows"), value: rows.length, mono: true, tone: "strong" },
        ...(qtyKeys.slice(0, 2).map((k) => {
          const col = apiCols.find((c) => c.key === k);
          return { label: col?.label ?? k, value: num(Number(totals[k] ?? sumKey(k))), mono: true };
        }) as ReportCard["rows"]),
        ...(moneyKeys.slice(0, 1).map((k) => {
          const col = apiCols.find((c) => c.key === k);
          return { label: `${col?.label ?? k} (${fc})`, value: money(Number(totals[k] ?? sumKey(k))), mono: true, tone: "strong" as const };
        }) as ReportCard["rows"]),
      ],
    },
    {
      key: "breakdown",
      title: s.t("card_breakdown", "Distribution"),
      subtitle: s.t("card_breakdown_sub", "Across the loaded rows"),
      icon: <Layers className="h-4 w-4" />,
      accent: "purple",
      rows: [
        { label: s.t("b_goods", "Distinct Goods"), value: distinct("goodsName") || distinct("group"), mono: true },
        { label: s.t("b_warehouses", "Warehouses"), value: distinct("warehouseName"), mono: true },
        { label: s.t("b_low", "Low-Stock Lines"), value: rows.filter((r) => Number(r.shortfall) > 0).length, tone: "negative", mono: true },
      ],
    },
    {
      key: "coverage",
      title: s.t("card_coverage", "Country Coverage"),
      subtitle: s.t("card_coverage_sub", "Where stock sits (loaded rows)"),
      icon: <Globe2 className="h-4 w-4" />,
      accent: "orange",
      rows: [
        { label: s.t("c_countries", "Countries"), value: distinct("countryName") || distinct("group"), mono: true },
      ],
      footer: { label: s.t("c_report", "Active Report"), value: s.t(`opt_${type}`, type.replace(/_/g, " ")) },
    },
  ], [s, rows, apiCols, type, moneyKeys, qtyKeys, totals, fc]);

  const cellFmt = (c: ApiCol, v: unknown) => {
    if (v === null || v === undefined || v === "") return "—";
    if (c.kind === "money") return money(v);
    if (c.kind === "qty") return num(v);
    if (c.kind === "date" || /date|_at$/i.test(c.key)) {
      const d = new Date(String(v));
      return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString("en-GB");
    }
    return String(v);
  };

  const shellCols: ReportTableColumn[] = apiCols.map((c) => ({
    key: c.key, label: c.label,
    align: c.kind === "money" || c.kind === "qty" || c.align === "right" ? "end" : c.align === "center" ? "center" : "start",
    render: (r: Record<string, unknown>) => cellFmt(c, r[c.key]),
  }));

  const footerRow = Object.keys(totals).length
    ? (() => {
        const fr: Record<string, unknown> = {};
        apiCols.forEach((c, i) => {
          const t = totals[c.key];
          fr[c.key] = t !== undefined ? t : i === 0 ? s.t("row_total", "Total") : "";
        });
        return fr;
      })()
    : undefined;

  const printInput = () => {
    const pdfCols: UrpColumn[] = apiCols.map((c) => ({
      key: c.key, label: c.label,
      align: c.kind === "money" || c.kind === "qty" || c.align === "right" ? "end" : c.align === "center" ? "center" : "start",
    }));
    const prows = rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const c of apiCols) o[c.key] = cellFmt(c, r[c.key]);
      return o;
    });
    const ptotals: Record<string, string | number> = {};
    for (const c of apiCols) {
      const t = totals[c.key];
      if (t !== undefined) ptotals[c.key] = c.kind === "money" ? money(t) : c.kind === "qty" ? num(t) : String(t);
    }
    return {
      lang: s.lang,
      title: s.t("title", "Inventory & Stock Reports"),
      subtitle: s.t(`opt_${type}`, type.replace(/_/g, " ")),
      fileSlug: `inventory-report-${type}`,
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
      table: { title: s.t(`opt_${type}`, type.replace(/_/g, " ")), columns: pdfCols, rows: prows, totals: Object.keys(ptotals).length ? ptotals : undefined },
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
    a.download = `inventory-report-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <UniversalReportShell
      title={s.t("title", "Inventory & Stock Reports")}
      subtitle={s.t("subtitle", "Stock on hand, valuation, movements and reorder levels")}
      locationLine={[context.branchName, context.city, context.country].filter((x) => x && x !== "—").join(", ")}
      bannerImage={context.bannerImage}
      scopeBadge={context.scopeLabel || context.accessScope}
      reportGroups={[
        {
          label: s.t("grp_position", "Stock Position"),
          items: [
            { value: "stock_on_hand", label: s.t("opt_stock_on_hand", "Stock on Hand") },
            { value: "stock_valuation", label: s.t("opt_stock_valuation", "Stock Valuation") },
            { value: "low_stock", label: s.t("opt_low_stock", "Low Stock / Reorder") },
          ],
        },
        {
          label: s.t("grp_grouped", "Grouped"),
          items: [
            { value: "warehouse_wise", label: s.t("opt_warehouse_wise", "Warehouse-wise") },
            { value: "country_wise", label: s.t("opt_country_wise", "Country-wise") },
            { value: "goods_wise", label: s.t("opt_goods_wise", "Goods-wise") },
          ],
        },
        {
          label: s.t("grp_ledger", "Movement Ledger"),
          items: [
            { value: "stock_movements", label: s.t("opt_stock_movements", "Stock Movement Journal") },
          ],
        },
      ]}
      selectedReport={type}
      onSelectReport={(v) => { if ((TYPES as readonly string[]).includes(v)) setType(v); }}
      filters={filters}
      onFiltersChange={setFilters}
      onApplyFilters={() => setApplied(filters)}
      filterOptions={{ countries, states: [], cities: [], branches: [], statuses: [] }}
      showFilters={{ stateId: false, cityId: false, branchId: false, status: false, dateFrom: type === "stock_movements", dateTo: type === "stock_movements" }}
      branchUser={{
        country: context.country, state: context.state, city: context.city,
        branchName: context.branchName, branchCode: context.branchCode,
        userId: context.userId.slice(0, 18), userName: context.userName, role: context.role,
        accessScope: context.accessScope, dateTime: new Date().toLocaleString("en-GB"), online: context.online,
      }}
      cards={cards}
      table={{
        title: s.t(`opt_${type}`, type.replace(/_/g, " ")),
        subtitle: s.t("table_sub", "Live from the inventory module"),
        columns: shellCols.length ? shellCols : [{ key: "_", label: "—", align: "start" }],
        rows,
        totalCount: rows.length,
        footerRow,
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
