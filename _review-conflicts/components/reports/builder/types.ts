import { type ReactNode } from "react";
import { type ColumnDef } from "@tanstack/react-table";

export type ReportColumnConfig = {
  id: string;
  label: string;
  visible: boolean;
  order: number;
  align?: "left" | "center" | "right";
  isSortable?: boolean;
  width?: string;
};

export type ReportFilterRule = {
  id: string;
  fieldId: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "between" | "in";
  value: string | string[] | boolean | number;
};

export type ReportSortConfig = {
  fieldId: string;
  direction: "asc" | "desc";
} | null;

export type SavedReportConfig = {
  id?: string;
  name: string;
  module: string;
  columns: ReportColumnConfig[];
  filters: ReportFilterRule[];
  sort: ReportSortConfig;
  dateRange: {
    from: string;
    to: string;
    preset?: string;
  };
  isPublic?: boolean;
};

export type ReportFieldDefinition = {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "currency" | "status" | "boolean";
  options?: { label: string; value: string }[];
  cellRenderer?: (value: any, row: any) => ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
  isSortable?: boolean;
};

export type ReportSummaryTotals = {
  label: string;
  value: ReactNode;
  align?: "left" | "center" | "right";
  color?: string;
}[];
