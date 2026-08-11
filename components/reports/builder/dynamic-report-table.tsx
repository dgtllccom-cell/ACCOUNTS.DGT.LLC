"use client";
import React, { useMemo } from "react";
import { type ReportColumnConfig, type ReportFieldDefinition, type ReportSortConfig, type ReportGroupConfig } from "./types";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Th } from "@/components/ui/translated-th";
import { t } from "@/lib/i18n/ui";
import { useActiveLanguage } from "@/lib/i18n/use-active-language";
import { translateHeader } from "@/lib/i18n/table-headers";

type DynamicReportTableProps = {
  data: any[];
  columns: ReportColumnConfig[];
  fields: ReportFieldDefinition[];
  sortConfig: ReportSortConfig;
  onSortChange: (config: ReportSortConfig) => void;
  isLoading?: boolean;
  groupBy?: ReportGroupConfig;
  showTotals?: boolean;
};

function sumColumn(rows: any[], fieldId: string) {
  return rows.reduce((sum, row) => sum + (Number(row[fieldId]) || 0), 0);
}

function formatCell(field: ReportFieldDefinition | undefined, value: any, row: any) {
  if (field?.cellRenderer) return field.cellRenderer(value, row);
  if (field?.type === "number" || field?.type === "currency") {
    const n = Number(value);
    if (!Number.isFinite(n)) return value ?? "";
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return value;
}

export function DynamicReportTable({
  data,
  columns,
  fields,
  sortConfig,
  onSortChange,
  isLoading,
  groupBy,
  showTotals
}: DynamicReportTableProps) {
  const lang = useActiveLanguage();
  const visibleColumns = columns.filter((c) => c.visible).sort((a, b) => a.order - b.order);
  const numericColumnIds = useMemo(
    () => new Set(fields.filter((f) => f.type === "number" || f.type === "currency").map((f) => f.id)),
    [fields]
  );

  const [collapsedGroups, setCollapsedGroups] = React.useState<Set<string>>(new Set());

  const handleSort = (fieldId: string) => {
    if (sortConfig?.fieldId === fieldId) {
      if (sortConfig.direction === "asc") {
        onSortChange({ fieldId, direction: "desc" });
      } else {
        onSortChange(null);
      }
    } else {
      onSortChange({ fieldId, direction: "asc" });
    }
  };

  const groupedRows = useMemo(() => {
    if (!groupBy?.fieldId) return null;
    const groups = new Map<string, any[]>();
    for (const row of data) {
      const key = String(row[groupBy.fieldId] ?? t(lang, "report.builder_ungrouped", "(Ungrouped)"));
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    return Array.from(groups.entries());
  }, [data, groupBy, lang]);

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function renderRow(row: any, rowIndex: number) {
    return (
      <tr key={row.id || rowIndex} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
        {visibleColumns.map((col) => {
          const field = fields.find((f) => f.id === col.id);
          const value = row[col.id];
          return (
            <td
              key={col.id}
              className={cn(
                "px-4 py-2.5",
                col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
              )}
            >
              {formatCell(field, value, row)}
            </td>
          );
        })}
      </tr>
    );
  }

  function renderTotalsRow(rows: any[], labelKey: string, labelDefault: string, emphasized = false) {
    return (
      <tr className={cn("border-t-2", emphasized ? "bg-slate-100 dark:bg-slate-900 font-bold" : "bg-slate-50/70 dark:bg-slate-900/40 font-semibold")}>
        {visibleColumns.map((col, idx) => {
          const isNumeric = numericColumnIds.has(col.id);
          if (idx === 0 && !isNumeric) {
            return (
              <td key={col.id} className="px-4 py-2 text-left text-xs text-slate-600 dark:text-slate-300">
                {t(lang, labelKey, labelDefault)} ({rows.length})
              </td>
            );
          }
          return (
            <td
              key={col.id}
              className={cn(
                "px-4 py-2 text-xs",
                col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
              )}
            >
              {isNumeric ? sumColumn(rows, col.id).toLocaleString(undefined, { maximumFractionDigits: 2 }) : ""}
            </td>
          );
        })}
      </tr>
    );
  }

  return (
    <div className="w-full overflow-auto border rounded-md bg-white dark:bg-slate-950">
      <table className="w-full text-sm text-left rtl:text-right">
        <thead className="bg-slate-50 dark:bg-slate-900 border-b">
          <tr>
            {visibleColumns.map((col) => {
              const field = fields.find((f) => f.id === col.id);
              const isSortable = field?.isSortable !== false;
              const isSorted = sortConfig?.fieldId === col.id;

              return (
                <Th
                  key={col.id}
                  className={cn(
                    "px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap",
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                    isSortable && "cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                    col.width
                  )}
                  style={{ width: col.width }}
                  onClick={() => isSortable && handleSort(col.id)}
                >
                  <div className={cn(
                    "flex items-center gap-1",
                    col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : "justify-start"
                  )}>
                    {translateHeader(lang, col.label)}
                    {isSortable && (
                      <span className="text-slate-400">
                        {isSorted ? (
                          sortConfig.direction === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                        )}
                      </span>
                    )}
                  </div>
                </Th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-slate-500">
                <div className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600"></div>
                  {t(lang, "report.builder_loading", "Loading data...")}
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-slate-500 italic">
                {t(lang, "report.builder_no_records", "No records found matching your filters.")}
              </td>
            </tr>
          ) : groupedRows ? (
            groupedRows.map(([groupKey, rows]) => {
              const isCollapsed = collapsedGroups.has(groupKey);
              return (
                <React.Fragment key={groupKey}>
                  <tr
                    className="bg-slate-100 dark:bg-slate-900/70 cursor-pointer select-none"
                    onClick={() => toggleGroup(groupKey)}
                  >
                    <td colSpan={visibleColumns.length} className="px-4 py-2 font-bold text-xs text-slate-700 dark:text-slate-200">
                      <div className="flex items-center gap-1.5">
                        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {groupKey}
                        <span className="font-normal text-slate-500">({rows.length})</span>
                      </div>
                    </td>
                  </tr>
                  {!isCollapsed && rows.map((row, idx) => renderRow(row, idx))}
                  {!isCollapsed && groupBy?.showSubtotals ? renderTotalsRow(rows, "report.builder_subtotal", "Subtotal") : null}
                </React.Fragment>
              );
            })
          ) : (
            data.map((row, rowIndex) => renderRow(row, rowIndex))
          )}
        </tbody>
        {showTotals && data.length > 0 ? (
          <tfoot>{renderTotalsRow(data, "report.builder_grand_total", "Grand Total", true)}</tfoot>
        ) : null}
      </table>
    </div>
  );
}
