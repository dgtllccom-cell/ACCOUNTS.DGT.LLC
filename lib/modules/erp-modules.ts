export const erpModules = [
  { code: "fms_core", name: "Financial Management System", financial: true, status: "active" },
  { code: "shipping_line", name: "Shipping Line Module", financial: true, status: "planned" },
  { code: "clearing_agent", name: "Clearing Agent Module", financial: true, status: "planned" },
  { code: "sales_purchase", name: "Sales and Purchase Module", financial: true, status: "planned" },
  { code: "inventory", name: "Inventory Module", financial: true, status: "planned" },
  { code: "warehouse", name: "Warehouse Module", financial: false, status: "planned" },
  { code: "hr_payroll", name: "HR and Payroll Module", financial: true, status: "planned" },
  { code: "marketing", name: "Marketing Module", financial: false, status: "planned" },
  { code: "document_management", name: "Document Management Module", financial: false, status: "planned" },
  { code: "crm", name: "CRM Module", financial: false, status: "planned" },
  { code: "reports", name: "Reporting Module", financial: false, status: "active" }
] as const;

export type ErpModuleCode = (typeof erpModules)[number]["code"];

export const moduleIntegrationRules = [
  "country_scope",
  "branch_scope",
  "role_permissions",
  "approval_workflow",
  "audit_logs",
  "translations",
  "ledger_posting_when_financial",
  "reports",
  "attachments",
  "number_sequence"
] as const;

