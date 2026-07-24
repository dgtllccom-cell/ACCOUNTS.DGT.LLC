"use client";
import React, { useState, useMemo, useEffect } from "react";
import { 
  type ReportColumnConfig, 
  type ReportFilterRule, 
  type ReportSortConfig, 
  type ReportFieldDefinition,
  type SavedReportConfig 
} from "./types";
import { ColumnManager } from "./column-manager";
import { FilterManager } from "./filter-manager";
import { DynamicReportTable } from "./dynamic-report-table";
import { SavedReportsManager } from "./saved-reports-manager";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Settings2, Download, Printer } from "lucide-react";

type CustomReportBuilderProps = {
  moduleName: string;
  data: any[];
  fields: ReportFieldDefinition[];
  defaultColumns: ReportColumnConfig[];
  onExportExcel?: (filteredData: any[], columns: ReportColumnConfig[]) => void;
  onExportPdf?: (filteredData: any[], columns: ReportColumnConfig[]) => void;
  onPrint?: (filteredData: any[], columns: ReportColumnConfig[]) => void;
  isLoading?: boolean;
};

export function CustomReportBuilder({
  moduleName,
  data,
  fields,
  defaultColumns,
  onExportExcel,
  onExportPdf,
  onPrint,
  isLoading
}: CustomReportBuilderProps) {
  const [columns, setColumns] = useState<ReportColumnConfig[]>(defaultColumns);
  const [filters, setFilters] = useState<ReportFilterRule[]>([]);
  const [sortConfig, setSortConfig] = useState<ReportSortConfig>(null);
  
  // Date range specifically for the report builder (if needed as a top level filter)
  const [dateRange, setDateRange] = useState({ from: "", to: "", preset: "all" });

  const handleLoadSavedReport = (config: SavedReportConfig) => {
    if (config.columns) setColumns(config.columns);
    if (config.filters) setFilters(config.filters);
    if (config.sort !== undefined) setSortConfig(config.sort);
    if (config.dateRange) setDateRange(config.dateRange);
  };

  const filteredData = useMemo(() => {
    let result = [...data];

    // Apply Date Range
    if (dateRange.from && dateRange.to) {
      result = result.filter((row) => {
        // Assuming every row has an 'entryDate' or 'date' field. We can configure this via fields if needed.
        const rowDateStr = row.entryDate || row.date || row.createdAt; 
        if (!rowDateStr) return true;
        const rowDate = new Date(rowDateStr).getTime();
        const fromDate = new Date(dateRange.from).getTime();
        const toDate = new Date(dateRange.to).getTime();
        return rowDate >= fromDate && rowDate <= toDate;
      });
    }

    // Apply Filters
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

    // Apply Sorting
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
  }, [data, filters, sortConfig, dateRange]);

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-950 p-4 rounded-lg border shadow-sm">
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Saved Reports Manager */}
          <SavedReportsManager 
            moduleName={moduleName} 
            onLoadReport={handleLoadSavedReport}
            currentConfig={{
              columns,
              filters,
              sort: sortConfig,
              dateRange
            }}
          />

          {/* Columns Config */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Settings2 className="h-4 w-4 mr-2" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0">
              <ColumnManager columns={columns} onChange={setColumns} />
            </PopoverContent>
          </Popover>

          {/* Export Actions */}
          <div className="flex items-center gap-1 border-l pl-2 ml-1">
            {onExportExcel && (
              <Button variant="ghost" size="sm" onClick={() => onExportExcel(filteredData, columns)}>
                <Download className="h-4 w-4 mr-2" /> Excel
              </Button>
            )}
            {onPrint && (
              <Button variant="ghost" size="sm" onClick={() => onPrint(filteredData, columns)}>
                <Printer className="h-4 w-4 mr-2" /> Print
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-950 rounded-lg border shadow-sm">
        <FilterManager fields={fields} filters={filters} onChange={setFilters} />
      </div>

      <div className="bg-white dark:bg-slate-950 rounded-lg shadow-sm">
        <DynamicReportTable
          data={filteredData}
          columns={columns}
          fields={fields}
          sortConfig={sortConfig}
          onSortChange={setSortConfig}
          isLoading={isLoading}
        />
        
        {/* Footer / Summary Info */}
        <div className="border-t p-4 flex justify-between items-center text-sm text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-b-lg">
          <div>Showing {filteredData.length} records {data.length !== filteredData.length && `(filtered from ${data.length})`}</div>
        </div>
      </div>
    </div>
  );
}
