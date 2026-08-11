"use client";
import React, { useState, useMemo, useCallback } from "react";
import {
  type ReportColumnConfig,
  type ReportFilterRule,
  type ReportSortConfig,
  type ReportFieldDefinition,
  type SavedReportConfig,
  type ReportGroupConfig
} from "./types";
import { ColumnManager } from "./column-manager";
import { FilterManager } from "./filter-manager";
import { GroupByManager } from "./group-by-manager";
import { DynamicReportTable } from "./dynamic-report-table";
import { SavedReportsManager } from "./saved-reports-manager";
import { ReportChartPanel } from "./report-chart-panel";
import { AutoEmailManager } from "./auto-email-manager";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings2, Download, Printer, FileText, BarChart3, PanelLeftClose, PanelLeft, Sigma, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";
import { buildProfessionalReportHtml, openProfessionalReportWindow } from "@/lib/reports/professional-pdf-reports";

type CustomReportBuilderProps = {
  moduleName: string;
  reportTitle: string;
  data: any[];
  fields: ReportFieldDefinition[];
  defaultColumns: ReportColumnConfig[];
  /** Field id to use for the built-in date-range filter (defaults to the first "date" field found). */
  dateFieldId?: string;
  isLoading?: boolean;
};

/**
 * Generic, reusable "Report View" builder — Pick Columns, Add/Remove Filters, date range,
 * Group By, Show Totals, Toggle Chart, Toggle Sidebar, Print, Export, Save As, Auto Email.
 * Works against whatever `data`/`fields` a report page hands it; every report exposes only
 * the fields/filters/totals it actually has via its own `fields` definition — nothing here
 * is hardcoded to one module. Drop this INTO an existing report page (see
 * features/sales/components/sales-booking-journal-report-view.tsx for the first wiring) —
 * it does not fetch data or replace a module's existing filters/print/API; it is purely an
 * additional, opt-in layer on top of already-loaded report rows.
 */
export function CustomReportBuilder({
  moduleName,
  reportTitle,
  data,
  fields,
  defaultColumns,
  dateFieldId,
  isLoading
}: CustomReportBuilderProps) {
  const lang = useActiveLanguage();
  const [columns, setColumns] = useState<ReportColumnConfig[]>(defaultColumns);
  const [filters, setFilters] = useState<ReportFilterRule[]>([]);
  const [sortConfig, setSortConfig] = useState<ReportSortConfig>(null);
  const [groupBy, setGroupBy] = useState<ReportGroupConfig>(null);
  const [showTotals, setShowTotals] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [chartFieldId, setChartFieldId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);

  const effectiveDateField = dateFieldId ?? fields.find((f) => f.type === "date")?.id;
  const [dateRange, setDateRange] = useState({ from: "", to: "", preset: "all" });

  const handleLoadSavedReport = (config: SavedReportConfig) => {
    // Guard against an empty/corrupted saved columns list wiping the table out entirely —
    // fall back to the report's own default columns rather than rendering a headerless,
    // rowless table.
    if (config.columns && config.columns.length > 0) setColumns(config.columns);
    if (config.filters) setFilters(config.filters);
    if (config.sort !== undefined) setSortConfig(config.sort);
    if (config.dateRange) setDateRange({ from: config.dateRange.from, to: config.dateRange.to, preset: config.dateRange.preset ?? "all" });
    if (config.groupBy !== undefined) setGroupBy(config.groupBy ?? null);
    if (config.showTotals !== undefined) setShowTotals(!!config.showTotals);
    if (config.showChart !== undefined) setShowChart(!!config.showChart);
    if (config.chartFieldId !== undefined) setChartFieldId(config.chartFieldId ?? null);
    if (config.id) setSavedReportId(config.id);
  };

  const filteredData = useMemo(() => {
    let result = [...data];

    if (effectiveDateField && dateRange.from && dateRange.to) {
      result = result.filter((row) => {
        const rowDateStr = row[effectiveDateField] || row.entryDate || row.date || row.createdAt;
        if (!rowDateStr) return true;
        const rowDate = new Date(rowDateStr).getTime();
        const fromDate = new Date(dateRange.from).getTime();
        const toDate = new Date(dateRange.to).getTime();
        return rowDate >= fromDate && rowDate <= toDate;
      });
    }

    filters.forEach((filter) => {
      const { fieldId, operator, value } = filter;
      if (value === "" || value === undefined || value === null) return;

      result = result.filter((row) => {
        const rowValue = row[fieldId];
        if (rowValue === undefined || rowValue === null) return false;

        const strRowVal = String(rowValue).toLowerCase();
        const strFilterVal = String(value).toLowerCase();

        switch (operator) {
          case "contains":
            return strRowVal.includes(strFilterVal);
          case "equals":
            return strRowVal === strFilterVal;
          case "not_equals":
            return strRowVal !== strFilterVal;
          case "greater_than":
            return Number(rowValue) > Number(value);
          case "less_than":
            return Number(rowValue) < Number(value);
          default:
            return true;
        }
      });
    });

    if (sortConfig) {
      const { fieldId, direction } = sortConfig;
      result.sort((a, b) => {
        const aVal = a[fieldId];
        const bVal = b[fieldId];

        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        const modifier = direction === "asc" ? 1 : -1;
        if (typeof aVal === "number" && typeof bVal === "number") {
          return (aVal - bVal) * modifier;
        }
        return String(aVal).localeCompare(String(bVal)) * modifier;
      });
    }

    return result;
  }, [data, filters, sortConfig, dateRange, effectiveDateField]);

  const visibleColumns = useMemo(() => columns.filter((c) => c.visible).sort((a, b) => a.order - b.order), [columns]);

  const buildReportHtml = useCallback(() => {
    return buildProfessionalReportHtml({
      language: lang,
      meta: {
        title: reportTitle,
        generatedAt: new Date().toLocaleString()
      },
      table: {
        columns: visibleColumns.map((c) => translateHeader(lang, c.label)),
        rows: filteredData.map((row) => visibleColumns.map((c) => row[c.id] ?? ""))
      }
    });
  }, [lang, reportTitle, visibleColumns, filteredData]);

  function handlePrint() {
    openProfessionalReportWindow(buildReportHtml(), true);
  }

  function handlePdfExport() {
    // Same print-ready HTML window as Print — the browser's "Save as PDF" destination in the
    // print dialog is this codebase's existing, already-proven PDF path (see every other
    // *-print-report.ts helper in lib/reports/); there is no separate binary PDF pipeline to
    // duplicate here.
    openProfessionalReportWindow(buildReportHtml(), true);
  }

  function handleExcelExport() {
    const headers = visibleColumns.map((c) => translateHeader(lang, c.label));
    const rows = filteredData.map((row) => visibleColumns.map((c) => row[c.id] ?? ""));
    const csvContent = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${moduleName}_report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col space-y-4 min-w-0 max-w-full" dir="auto">
      <div className="flex flex-col gap-3 bg-white dark:bg-slate-950 p-3 sm:p-4 rounded-lg border shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <SavedReportsManager
            moduleName={moduleName}
            onLoadReport={handleLoadSavedReport}
            onSaved={(report) => setSavedReportId(report.id ?? null)}
            currentConfig={{ columns, filters, sort: sortConfig, dateRange, groupBy, showTotals, showChart, chartFieldId }}
          />

          <Button
            variant={showSidebar ? "secondary" : "outline"}
            size="sm"
            className="h-9"
            onClick={() => setShowSidebar((v) => !v)}
            title={t(lang, "report.builder_toggle_sidebar", "Toggle Sidebar")}
          >
            {showSidebar ? <PanelLeftClose className="h-4 w-4 mr-1.5" /> : <PanelLeft className="h-4 w-4 mr-1.5" />}
            {t(lang, "report.builder_sidebar", "Sidebar")}
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Settings2 className="h-4 w-4 mr-1.5" />
                {t(lang, "report.builder_columns", "Columns")}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0">
              <ColumnManager columns={columns} onChange={setColumns} />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant={groupBy?.fieldId ? "secondary" : "outline"} size="sm" className="h-9">
                <Layers className="h-4 w-4 mr-1.5" />
                {t(lang, "report.builder_group", "Group")}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-0">
              <GroupByManager fields={fields} groupBy={groupBy} onChange={setGroupBy} />
            </PopoverContent>
          </Popover>

          <Button
            variant={showTotals ? "secondary" : "outline"}
            size="sm"
            className="h-9"
            onClick={() => setShowTotals((v) => !v)}
          >
            <Sigma className="h-4 w-4 mr-1.5" />
            {t(lang, "report.builder_show_totals", "Show Totals")}
          </Button>

          <Button
            variant={showChart ? "secondary" : "outline"}
            size="sm"
            className="h-9"
            onClick={() => setShowChart((v) => !v)}
          >
            <BarChart3 className="h-4 w-4 mr-1.5" />
            {t(lang, "report.builder_chart", "Chart")}
          </Button>

          <div className="flex items-center gap-1 border-l rtl:border-l-0 rtl:border-r pl-2 rtl:pl-0 rtl:pr-2 ml-1 rtl:ml-0 rtl:mr-1">
            <Button variant="ghost" size="sm" onClick={handlePrint} title={t(lang, "report.builder_print", "Print")}>
              <Printer className="h-4 w-4 mr-1.5" /> {t(lang, "report.builder_print", "Print")}
            </Button>
            <Button variant="ghost" size="sm" onClick={handlePdfExport} title={t(lang, "report.builder_pdf", "PDF")}>
              <FileText className="h-4 w-4 mr-1.5" /> PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={handleExcelExport} title={t(lang, "report.builder_excel", "Excel")}>
              <Download className="h-4 w-4 mr-1.5" /> {t(lang, "report.builder_excel", "Excel")}
            </Button>
          </div>

          <AutoEmailManager savedReportId={savedReportId} reportName={reportTitle} buildEmailHtml={buildReportHtml} />
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t pt-3">
          {effectiveDateField ? (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">{t(lang, "report.builder_date_from", "From")}</label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange((d) => ({ ...d, from: e.target.value }))}
                  className="h-8 text-xs border rounded px-2 bg-white dark:bg-slate-950"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">{t(lang, "report.builder_date_to", "To")}</label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange((d) => ({ ...d, to: e.target.value }))}
                  className="h-8 text-xs border rounded px-2 bg-white dark:bg-slate-950"
                />
              </div>
              {(dateRange.from || dateRange.to) && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setDateRange({ from: "", to: "", preset: "all" })}>
                  {t(lang, "report.builder_clear_dates", "Clear dates")}
                </Button>
              )}
            </>
          ) : null}
        </div>
      </div>

      <div className={cn("grid gap-4 min-w-0", showSidebar ? "grid-cols-1 lg:grid-cols-[280px_1fr]" : "grid-cols-1")}>
        {showSidebar ? (
          <div className="bg-white dark:bg-slate-950 rounded-lg border shadow-sm h-fit">
            <FilterManager fields={fields} filters={filters} onChange={setFilters} />
          </div>
        ) : null}

        <div className="space-y-4 min-w-0">
          {showChart ? (
            <div className="bg-white dark:bg-slate-950 rounded-lg border shadow-sm">
              <ReportChartPanel
                data={filteredData}
                fields={fields}
                groupFieldId={groupBy?.fieldId ?? null}
                chartFieldId={chartFieldId}
                onChartFieldChange={setChartFieldId}
              />
            </div>
          ) : null}

          <div className="bg-white dark:bg-slate-950 rounded-lg shadow-sm">
            <DynamicReportTable
              data={filteredData}
              columns={columns}
              fields={fields}
              sortConfig={sortConfig}
              onSortChange={setSortConfig}
              isLoading={isLoading}
              groupBy={groupBy}
              showTotals={showTotals}
            />

            <div className="border-t p-3 sm:p-4 flex flex-wrap justify-between items-center gap-2 text-xs sm:text-sm text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-b-lg">
              <div>
                {t(lang, "report.builder_showing_records", "Showing {count} records").replace("{count}", String(filteredData.length))}
                {data.length !== filteredData.length && ` (${t(lang, "report.builder_filtered_from", "filtered from {total}").replace("{total}", String(data.length))})`}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
