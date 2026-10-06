export type ReportDefinitionContract = {
  reportCode: string;
  moduleCode: string;
  requiredPermission: string;
  scopeLevel: "global" | "country" | "main_branch" | "city_branch" | "assigned";
  defaultCurrency: "USD";
  filters: string[];
  columns: string[];
  grouping: string[];
  exportTypes: Array<"pdf" | "excel" | "print">;
  translationKeys: string[];
};

export const financialReportSourceOrder = [
  "ledger_entries",
  "ledger_balances",
  "posted_transactions",
  "report_snapshots"
] as const;

export const standardReportFlow = [
  "resolve_user_scope",
  "validate_filters",
  "query_normalized_data",
  "apply_usd_conversion",
  "create_report_run",
  "create_report_snapshot",
  "export_pdf_excel_or_print"
] as const;

export const enterpriseReportCodes = [
  "daily_report",
  "ledger_report",
  "roznamcha_report",
  "payment_report",
  "receipt_report",
  "country_report",
  "branch_report",
  "usd_report",
  "sales_report",
  "purchase_report",
  "audit_report",
  "trial_balance",
  "balance_sheet",
  "profit_loss"
] as const;

