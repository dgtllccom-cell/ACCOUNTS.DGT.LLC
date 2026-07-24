"use client";
import React from "react";
import { type ReportColumnConfig, type ReportFieldDefinition, type ReportSortConfig } from "./types";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

type DynamicReportTableProps = {
  data: any[];
  columns: ReportColumnConfig[];
  fields: ReportFieldDefinition[];
  sortConfig: ReportSortConfig;
  onSortChange: (config: ReportSortConfig) => void;
  isLoading?: boolean;
};

export function DynamicReportTable({
  data,
  columns,
  fields,
  sortConfig,
  onSortChange,
  isLoading
}: DynamicReportTableProps) {
  const visibleColumns = columns.filter((c) => c.visible).sort((a, b) => a.order - b.order);

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

  return (
    <div className="w-full overflow-auto border rounded-md bg-white dark:bg-slate-950">
      <table className="w-full text-sm text-left">
        <thead className="bg-slate-50 dark:bg-slate-900 border-b">
          <tr>
            {visibleColumns.map((col) => {
              const field = fields.find((f) => f.id === col.id);
              const isSortable = field?.isSortable !== false;
              const isSorted = sortConfig?.fieldId === col.id;

              return (
                <th
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
                    {col.label}
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
                </th>
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
                  Loading data...
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-slate-500 italic">
                No records found matching your filters.
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={row.id || rowIndex}
                className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
              >
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
                      {field?.cellRenderer ? field.cellRenderer(value, row) : value}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
