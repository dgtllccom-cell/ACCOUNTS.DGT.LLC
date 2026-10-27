import type { EnterpriseRole } from "./enterprise-roles";
import { enterpriseRolePermissions, enterpriseRoleScopes } from "./enterprise-roles";

export type ErpActionKey =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "submit_transfer"
  | "approve"
  | "print"
  | "export";

export const ERP_ACTION_KEYS: readonly ErpActionKey[] = [
  "view",
  "create",
  "edit",
  "delete",
  "submit_transfer",
  "approve",
  "print",
  "export"
] as const;

export const ERP_ACTION_LABELS: Record<ErpActionKey, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
  submit_transfer: "Submit / Transfer",
  approve: "Approve / Post",
  print: "Print",
  export: "Export"
};

export interface ErpFormPermissionDef {
  key: string;
  name: string;
  description?: string;
  actions: Record<ErpActionKey, string[]>;
}

export interface ErpSectionPermissionDef {
  key: string;
  name: string;
  forms: ErpFormPermissionDef[];
}

export interface ErpModulePermissionDef {
  key: string;
  name: string;
  category: "Finance & Accounting" | "Trading & Inventory" | "Logistics & Customs" | "Administration, HR & System";
  sections: ErpSectionPermissionDef[];
}

export interface ModulePermissionCapability {
  moduleKey: string;
  moduleName: string;
  category: "Finance & Accounting" | "Trading & Inventory" | "Logistics & Customs" | "Administration, HR & System";
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canPostApprove: boolean;
  canPrintExport: boolean;
  canSubmitTransfer?: boolean;
  notes?: string;
}

export interface RbacRoleSummary {
  role: EnterpriseRole;
  roleTitle: string;
  scopeDescription: string;
  isSuperAdmin: boolean;
  accessibleModules: ModulePermissionCapability[];
  restrictedModules: string[];
  supervisorPrivileges: string[];
}

export interface ErpModuleDef {
  key: string;
  name: string;
  category: "Finance & Accounting" | "Trading & Inventory" | "Logistics & Customs" | "Administration, HR & System";
  viewPerms: string[];
  createPerms: string[];
  editPerms: string[];
  deletePerms: string[];
  approvePerms: string[];
  exportPerms: string[];
  submitTransferPerms?: string[];
}

/**
 * 4-TIER AUTHORITATIVE PERMISSION HIERARCHY
 * Module -> Section -> Form / Bill Type -> Allowed Actions (8 toggles)
 */
export const ERP_PERMISSION_HIERARCHY: ErpModulePermissionDef[] = [
  // 1. CUSTOMER ORDERS & SHIPPING MANAGEMENT
  {
    key: "customer_orders_shipping",
    name: "Customer Orders & Logistics Operations",
    category: "Logistics & Customs",
    sections: [
      {
        key: "sec_customer_orders",
        name: "Customer Orders (3-Step Lifecycle)",
        forms: [
          {
            key: "customer_orders_step_1a",
            name: "Customer & Route (Step 1A / E1)",
            description: "Account & customer selection, origin/destination corridors, commercial parties, customs and destination",
            actions: {
              view: ["customer_orders:step_1a:read", "shipping_records:read", "route:/dashboard/clearing-agent/customer-order"],
              create: ["customer_orders:step_1a:create", "shipping_records:create"],
              edit: ["customer_orders:step_1a:update", "shipping_records:update"],
              delete: ["customer_orders:step_1a:delete"],
              submit_transfer: ["customer_orders:step_1a:transfer", "shipping_transfers:create", "record_transfers:create"],
              approve: ["customer_orders:step_1a:approve", "approvals:approve"],
              print: ["customer_orders:print", "reports:read"],
              export: ["customer_orders:export", "reports:export"]
            }
          },
          {
            key: "customer_orders_step_1b",
            name: "Truck & Loading (Step 1B)",
            description: "Vehicle registration, trailer details, driver allocation, weighment slip and loading verification",
            actions: {
              view: ["customer_orders:step_1b:read", "shipping_records:read"],
              create: ["customer_orders:step_1b:create", "shipping_records:create"],
              edit: ["customer_orders:step_1b:update", "shipping_records:update"],
              delete: ["customer_orders:step_1b:delete"],
              submit_transfer: ["customer_orders:step_1b:transfer", "shipping_transfers:create"],
              approve: ["customer_orders:step_1b:approve", "approvals:approve"],
              print: ["customer_orders:print", "reports:read"],
              export: ["customer_orders:export", "reports:export"]
            }
          },
          {
            key: "customer_orders_step_1c",
            name: "Goods & Package (Step 1C)",
            description: "Commodity description, packaging type, HS codes, weights, quantities and customs documentation",
            actions: {
              view: ["customer_orders:step_1c:read", "shipping_records:read"],
              create: ["customer_orders:step_1c:create", "shipping_records:create"],
              edit: ["customer_orders:step_1c:update", "shipping_records:update"],
              delete: ["customer_orders:step_1c:delete"],
              submit_transfer: ["customer_orders:step_1c:transfer", "shipping_transfers:create"],
              approve: ["customer_orders:step_1c:approve", "approvals:approve"],
              print: ["customer_orders:print", "reports:read"],
              export: ["customer_orders:export", "reports:export"]
            }
          }
        ]
      },
      {
        key: "sec_shipping_line_ops",
        name: "Shipping Line Operations",
        forms: [
          {
            key: "shipping_line_shipment_details",
            name: "Shipment Details",
            description: "Sea freight shipments, vessel voyages, feeder schedules and container slots",
            actions: {
              view: ["shipments:read", "route:/dashboard/shipping-line"],
              create: ["shipments:create"],
              edit: ["shipments:update"],
              delete: ["shipments:delete"],
              submit_transfer: ["shipping_transfers:create"],
              approve: ["shipping_transfers:approve", "approvals:approve"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "shipping_line_bl_entry",
            name: "Bill of Lading (BL) Entry",
            description: "Master BL, House BL, container manifest and seal numbers",
            actions: {
              view: ["shipping_records:read", "route:/dashboard/shipping-line/bl-entry"],
              create: ["shipping_records:create"],
              edit: ["shipping_records:update"],
              delete: ["shipping_records:delete"],
              submit_transfer: ["shipping_transfers:create"],
              approve: ["record_transfers:create"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "shipping_line_shipment_report",
            name: "Shipment Report & Tracking",
            description: "Vessel position tracking, arrival notifications and container status logs",
            actions: {
              view: ["shipping_reports:read", "reports:read", "route:/dashboard/reports/shipping"],
              create: [],
              edit: [],
              delete: [],
              submit_transfer: [],
              approve: [],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "shipping_line_agent_entry",
            name: "Shipping Agent Entry",
            description: "Agent profiles, shipping line terminal representatives and branch connections",
            actions: {
              view: ["shipping_records:read", "route:/dashboard/city/shipping-line"],
              create: ["shipping_records:create"],
              edit: ["shipping_records:update"],
              delete: [],
              submit_transfer: ["shipping_transfers:create"],
              approve: [],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "shipping_line_handover_inbox",
            name: "Handover Inbox & Record Transfers",
            description: "Inter-branch order transfer queue, shifts, approvals and acceptance history",
            actions: {
              view: ["shipping_transfers:read", "route:/dashboard/shipping-line/handover-inbox"],
              create: ["shipping_transfers:create"],
              edit: ["shipping_transfers:update"],
              delete: [],
              submit_transfer: ["shipping_transfers:create"],
              approve: ["shipping_transfers:approve"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          }
        ]
      },
      {
        key: "sec_clearing_agent_ops",
        name: "Clearing Agent Operations",
        forms: [
          {
            key: "clearing_truck_registration",
            name: "Truck Registration",
            description: "Fleet database, driver licensing, vehicle ownership and fitness permits",
            actions: {
              view: ["clearing_agents:read", "route:/dashboard/clearing-agent/truck-registration"],
              create: ["clearing_agents:create"],
              edit: ["clearing_agents:update"],
              delete: [],
              submit_transfer: ["record_transfers:create"],
              approve: [],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "clearing_truck_loading",
            name: "Truck Loading & Dispatch",
            description: "Bay allocation, physical stuffing, cargo inspection and gate pass generation",
            actions: {
              view: ["shipping_records:read"],
              create: ["shipping_records:create"],
              edit: ["shipping_records:update"],
              delete: [],
              submit_transfer: ["record_transfers:create"],
              approve: [],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "clearing_cross_stuffing",
            name: "Cross Stuffing Terminal",
            description: "Transshipment container transfers, yard decanting and seal updates",
            actions: {
              view: ["shipping_records:read"],
              create: ["shipping_records:create"],
              edit: ["shipping_records:update"],
              delete: [],
              submit_transfer: ["record_transfers:create"],
              approve: [],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "clearing_agent_custom_entry",
            name: "Agent Custom Entry",
            description: "Declaration entries, customs gate documents and assessment records",
            actions: {
              view: ["clearing_agents:read", "route:/dashboard/clearing-agent/agent-custom-entry"],
              create: ["clearing_agents:create"],
              edit: ["clearing_agents:update"],
              delete: [],
              submit_transfer: ["record_transfers:create"],
              approve: [],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "clearing_bill_entry",
            name: "Clearing Bill Entry",
            description: "Customer service invoices, port charges and clearing commission bills",
            actions: {
              view: ["clearing_bill_customer_charges:read", "route:/dashboard/clearing-agent/customer-bill"],
              create: ["clearing_bill_customer_charges:create"],
              edit: ["clearing_bill_customer_charges:update"],
              delete: [],
              submit_transfer: ["record_transfers:create"],
              approve: ["approvals:approve"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "clearing_transit_entry",
            name: "Transit Entry",
            description: "International transit carnets, customs bond transit and corridor tracking",
            actions: {
              view: ["shipping_records:read"],
              create: ["shipping_records:create"],
              edit: ["shipping_records:update"],
              delete: [],
              submit_transfer: ["shipping_transfers:create"],
              approve: [],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "clearing_payment_bill_entry",
            name: "Payment Bill Entry",
            description: "Cash settlement, customs duty disbursement and clearing fee receipts",
            actions: {
              view: ["transactions:read", "route:/dashboard/clearing-agent/payment-bill-entry"],
              create: ["transactions:create"],
              edit: ["transactions:update"],
              delete: [],
              submit_transfer: [],
              approve: ["transactions:post"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          }
        ]
      }
    ]
  },

  // 2. EXPENSES & OPERATIONAL REGISTERS
  {
    key: "expenses_registers_module",
    name: "Expenses & Operational Registers",
    category: "Finance & Accounting",
    sections: [
      {
        key: "sec_expense_bills",
        name: "Expense Bill Types",
        forms: [
          {
            key: "expenses_customer",
            name: "Customer Expense Bill",
            description: "Disbursements on behalf of customers, demurrage, warehousing and handling",
            actions: {
              view: ["expenses_customer:read", "expenses:read", "route:/dashboard/clearing-agent/customer-expenses"],
              create: ["expenses_customer:create", "expenses:create"],
              edit: ["expenses_customer:update", "expenses:update"],
              delete: ["expenses_customer:delete", "expenses:delete"],
              submit_transfer: ["expenses_customer:transfer", "record_transfers:create"],
              approve: ["expenses_customer:approve", "expenses:post"],
              print: ["expenses_customer:print", "reports:read"],
              export: ["expenses_customer:export", "reports:export"]
            }
          },
          {
            key: "expenses_customs",
            name: "Customs Expense Bill",
            description: "Border customs duties, lab inspection fees, port authority dues and tariffs",
            actions: {
              view: ["expenses_customs:read", "expenses:read", "route:/dashboard/clearing-agent/customs-expenses"],
              create: ["expenses_customs:create", "expenses:create"],
              edit: ["expenses_customs:update", "expenses:update"],
              delete: ["expenses_customs:delete", "expenses:delete"],
              submit_transfer: ["expenses_customs:transfer", "record_transfers:create"],
              approve: ["expenses_customs:approve", "expenses:post"],
              print: ["expenses_customs:print", "reports:read"],
              export: ["expenses_customs:export", "reports:export"]
            }
          },
          {
            key: "expenses_truck",
            name: "Truck Expense Bill",
            description: "Transporter freight, driver advances, fuel slips, toll taxes and detention",
            actions: {
              view: ["expenses_truck:read", "expenses:read", "route:/dashboard/clearing-agent/truck-expenses"],
              create: ["expenses_truck:create", "expenses:create"],
              edit: ["expenses_truck:update", "expenses:update"],
              delete: ["expenses_truck:delete", "expenses:delete"],
              submit_transfer: ["expenses_truck:transfer", "record_transfers:create"],
              approve: ["expenses_truck:approve", "expenses:post"],
              print: ["expenses_truck:print", "reports:read"],
              export: ["expenses_truck:export", "reports:export"]
            }
          },
          {
            key: "expenses_other",
            name: "Other Expense Bill",
            description: "General branch administration expenses, utilities, supplies and sundries",
            actions: {
              view: ["expenses_other:read", "expenses:read", "route:/dashboard/clearing-agent/other-expenses"],
              create: ["expenses_other:create", "expenses:create"],
              edit: ["expenses_other:update", "expenses:update"],
              delete: ["expenses_other:delete", "expenses:delete"],
              submit_transfer: ["expenses_other:transfer", "record_transfers:create"],
              approve: ["expenses_other:approve", "expenses:post"],
              print: ["expenses_other:print", "reports:read"],
              export: ["expenses_other:export", "reports:export"]
            }
          }
        ]
      }
    ]
  },

  // 3. FINANCE & ACCOUNTING
  {
    key: "finance_accounting_module",
    name: "Finance & Accounting",
    category: "Finance & Accounting",
    sections: [
      {
        key: "sec_chart_ledgers",
        name: "Chart of Accounts & General Ledgers",
        forms: [
          {
            key: "chart_of_accounts",
            name: "New Account Setup (Chart of Accounts)",
            description: "Master ledger tree, asset/liability classifications and party accounts",
            actions: {
              view: ["accounts:read", "route:/dashboard/accounts/setup"],
              create: ["accounts:create", "route:/dashboard/accounts/setup"],
              edit: ["accounts:update", "route:/dashboard/accounts/setup"],
              delete: ["accounts:delete"],
              submit_transfer: [],
              approve: ["accounts:post"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "general_ledgers",
            name: "General Ledgers & Journal Entries",
            description: "Double-entry journal vouchers, ledger statements and trial balance",
            actions: {
              view: ["ledgers:read", "reports:read"],
              create: ["ledgers:create", "journal_entries:create"],
              edit: ["ledgers:update"],
              delete: ["ledgers:delete"],
              submit_transfer: [],
              approve: ["ledgers:post", "journal_entries:post"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "country_ledgers",
            name: "Country Ledgers & Regional Consolidation",
            description: "Multi-currency country level ledger consolidation and central audit",
            actions: {
              view: ["ledgers:read", "reports:read"],
              create: ["ledgers:create"],
              edit: ["ledgers:update"],
              delete: ["ledgers:delete"],
              submit_transfer: [],
              approve: ["ledgers:post"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "branch_ledgers",
            name: "Branch Ledgers & Daily Books",
            description: "Branch day book summaries, daily balance reconciliations and cash drawers",
            actions: {
              view: ["ledgers:read", "reports:read"],
              create: ["ledgers:create"],
              edit: ["ledgers:update"],
              delete: ["ledgers:delete"],
              submit_transfer: [],
              approve: ["ledgers:post"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          }
        ]
      },
      {
        key: "sec_cash_banking",
        name: "Daily Cash Books & Banking",
        forms: [
          {
            key: "roznamcha_cash_entry",
            name: "Roznamcha Daily Cash Books",
            description: "Daily cash debit/credit registers, safe box tally and morning opening entries",
            actions: {
              view: ["roznamcha:read", "transactions:read"],
              create: ["roznamcha:create", "transactions:create"],
              edit: ["roznamcha:update"],
              delete: [],
              submit_transfer: [],
              approve: ["roznamcha:post"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "cash_bank_vouchers",
            name: "Cash Receipts & Payments Vouchers",
            description: "Bank deposit slips, check registers, payment vouchers and receipt vouchers",
            actions: {
              view: ["transactions:read", "roznamcha:read"],
              create: ["transactions:create", "roznamcha:create"],
              edit: ["transactions:update"],
              delete: [],
              submit_transfer: [],
              approve: ["transactions:post"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "bank_accounts",
            name: "Bank Accounts & Reconciliation",
            description: "Corporate bank master, statement imports, IBAN records and reconciliation",
            actions: {
              view: ["banks:read", "accounts:read"],
              create: ["banks:create"],
              edit: ["banks:update"],
              delete: ["banks:delete"],
              submit_transfer: [],
              approve: ["accounts:post"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "uae_tax_einvoicing",
            name: "UAE Tax, VAT & e-Invoicing",
            description: "FTA tax invoices, 5% standard VAT, zero-rated exports and quarterly VAT returns",
            actions: {
              view: ["uae_tax:read"],
              create: ["uae_tax:write", "uae_tax_settings:write"],
              edit: ["uae_tax:write", "uae_tax_settings:write"],
              delete: [],
              submit_transfer: [],
              approve: ["uae_tax_filing:write"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          }
        ]
      }
    ]
  },

  // 4. TRADING & INVENTORY
  {
    key: "trading_inventory_module",
    name: "Trading & Inventory",
    category: "Trading & Inventory",
    sections: [
      {
        key: "sec_purchases",
        name: "Purchases & Inbound Cargo",
        forms: [
          {
            key: "purchase_booking",
            name: "Purchase Contracts, Orders & Invoices",
            description: "Supplier contracts, import purchase orders and vendor bills",
            actions: {
              view: ["purchases:read"],
              create: ["purchases:create"],
              edit: ["purchases:update"],
              delete: [],
              submit_transfer: ["record_transfers:create"],
              approve: ["purchases:post"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          }
        ]
      },
      {
        key: "sec_sales",
        name: "Sales & Invoicing",
        forms: [
          {
            key: "sales_invoicing",
            name: "Sales Contracts, Invoices & Quotations",
            description: "Customer sales agreements, export sales invoices and credit notes",
            actions: {
              view: ["sales:read"],
              create: ["sales:create"],
              edit: ["sales:update"],
              delete: [],
              submit_transfer: ["record_transfers:create"],
              approve: ["sales:post"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          }
        ]
      },
      {
        key: "sec_stock_transfers",
        name: "Inventory & Warehouses",
        forms: [
          {
            key: "stock_warehouse",
            name: "Stock Inventory & Item Master",
            description: "SKU creation, stock cards, lot numbers, valuation and reorder levels",
            actions: {
              view: ["inventory:read", "products:read"],
              create: ["products:create", "chs_products:create"],
              edit: ["products:update", "chs_products:update"],
              delete: ["products:delete", "chs_products:delete"],
              submit_transfer: ["inter_branch_transfers:create"],
              approve: ["inter_branch_transfers:approve"],
              print: ["reports:read"],
              export: ["chs_products:export"]
            }
          },
          {
            key: "warehouses_transfers",
            name: "Warehouses & Inter-Branch Transfers",
            description: "Warehouse locations, stock transfer orders and dispatch confirmations",
            actions: {
              view: ["warehouses:read", "inventory:read"],
              create: ["warehouses:create", "inter_branch_transfers:create"],
              edit: ["warehouses:update"],
              delete: ["warehouses:delete"],
              submit_transfer: ["inter_branch_transfers:create"],
              approve: ["inter_branch_transfers:approve"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          }
        ]
      }
    ]
  },

  // 5. ADMINISTRATION, HR & SYSTEM GOVERNANCE
  {
    key: "admin_hr_system_module",
    name: "Administration, HR & System Governance",
    category: "Administration, HR & System",
    sections: [
      {
        key: "sec_entities_crm",
        name: "Master Entities & Stakeholders",
        forms: [
          {
            key: "companies_owners",
            name: "Companies, Owners & Partners Master",
            description: "Entity legal licenses, partner equity distributions and company settings",
            actions: {
              view: ["companies:read"],
              create: ["companies:create"],
              edit: ["companies:update"],
              delete: ["companies:delete"],
              submit_transfer: [],
              approve: [],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "customers_suppliers",
            name: "Customers, Suppliers & Parties Master",
            description: "Customer accounts, supplier profiles, credit terms and tax IDs",
            actions: {
              view: ["customers:read"],
              create: ["customers:create"],
              edit: ["customers:update"],
              delete: [],
              submit_transfer: [],
              approve: [],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "currency_exchange",
            name: "Currency Exchange & Sarafi Rates",
            description: "Multi-currency exchange rates, market conversions and currency buy/sell registers",
            actions: {
              view: ["exchange_rates:read"],
              create: ["exchange_rates:create"],
              edit: ["exchange_rates:update"],
              delete: [],
              submit_transfer: [],
              approve: ["exchange_rates:approve"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          }
        ]
      },
      {
        key: "sec_hr_staff",
        name: "Human Resources & Payroll",
        forms: [
          {
            key: "hr_payroll",
            name: "HR & Payroll, Employees & Attendance",
            description: "Staff biometric attendance, salary sheets, WPS SIF generation and allowances",
            actions: {
              view: ["employees:read", "payroll:read"],
              create: ["employees:create", "payroll:create"],
              edit: ["employees:update", "payroll:update"],
              delete: ["employees:delete"],
              submit_transfer: [],
              approve: ["payroll:approve"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          }
        ]
      },
      {
        key: "sec_governance_security",
        name: "System Governance & Security",
        forms: [
          {
            key: "financial_reports",
            name: "Financial Reports & Analytical Statements",
            description: "Profit & Loss statements, balance sheets, cash flows and tax audits",
            actions: {
              view: ["reports:read", "ledgers:read"],
              create: [],
              edit: [],
              delete: [],
              submit_transfer: [],
              approve: [],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "user_management",
            name: "User Management & Role Permissions",
            description: "User account creation, scope assignment and granular form action matrices",
            actions: {
              view: ["users:read"],
              create: ["users:create"],
              edit: ["users:update"],
              delete: ["users:delete"],
              submit_transfer: [],
              approve: ["approvals:approve"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "system_governance",
            name: "System Settings & Audit Logs",
            description: "Audit trail inspection, financial period locks and global configuration",
            actions: {
              view: ["audit_logs:read", "financial_periods:read"],
              create: ["financial_periods:create"],
              edit: ["financial_periods:update"],
              delete: [],
              submit_transfer: [],
              approve: ["approvals:approve"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          },
          {
            key: "contract_control",
            name: "Central Contract Control Center",
            description: "Corporate contracts, validity dates, clauses and signatory authorizations",
            actions: {
              view: ["contracts:read"],
              create: ["contracts:write"],
              edit: ["contracts:write"],
              delete: [],
              submit_transfer: [],
              approve: ["contracts:write"],
              print: ["reports:read"],
              export: ["reports:export"]
            }
          }
        ]
      }
    ]
  }
];

/**
 * Backward-compatible ERP_MODULE_DEFINITIONS flattened from hierarchy
 * + explicitly maintained for existing consumers.
 */
export const ERP_MODULE_DEFINITIONS: ErpModuleDef[] = [
  // 1. Finance & Accounting
  {
    key: "chart_of_accounts",
    name: "New Account Setup (Chart of Accounts)",
    category: "Finance & Accounting",
    viewPerms: ["accounts:read", "route:/dashboard/accounts/setup"],
    createPerms: ["accounts:create", "route:/dashboard/accounts/setup"],
    editPerms: ["accounts:update", "route:/dashboard/accounts/setup"],
    deletePerms: ["accounts:delete"],
    approvePerms: ["accounts:post"],
    exportPerms: ["reports:export"]
  },
  {
    key: "general_ledgers",
    name: "General Ledgers & Journal Entries",
    category: "Finance & Accounting",
    viewPerms: ["ledgers:read", "reports:read"],
    createPerms: ["ledgers:create", "journal_entries:create"],
    editPerms: ["ledgers:update"],
    deletePerms: ["ledgers:delete"],
    approvePerms: ["ledgers:post", "journal_entries:post"],
    exportPerms: ["reports:export"]
  },
  {
    key: "country_ledgers",
    name: "Country Ledgers & Regional Consolidation",
    category: "Finance & Accounting",
    viewPerms: ["ledgers:read", "reports:read"],
    createPerms: ["ledgers:create"],
    editPerms: ["ledgers:update"],
    deletePerms: ["ledgers:delete"],
    approvePerms: ["ledgers:post"],
    exportPerms: ["reports:export"]
  },
  {
    key: "branch_ledgers",
    name: "Branch Ledgers & Daily Books",
    category: "Finance & Accounting",
    viewPerms: ["ledgers:read", "reports:read"],
    createPerms: ["ledgers:create"],
    editPerms: ["ledgers:update"],
    deletePerms: ["ledgers:delete"],
    approvePerms: ["ledgers:post"],
    exportPerms: ["reports:export"]
  },
  {
    key: "roznamcha_cash_entry",
    name: "Roznamcha Daily Cash Books",
    category: "Finance & Accounting",
    viewPerms: ["roznamcha:read", "transactions:read"],
    createPerms: ["roznamcha:create", "transactions:create"],
    editPerms: ["roznamcha:update"],
    deletePerms: [],
    approvePerms: ["roznamcha:post"],
    exportPerms: ["reports:export"]
  },
  {
    key: "cash_bank_vouchers",
    name: "Cash Receipts & Payments Vouchers",
    category: "Finance & Accounting",
    viewPerms: ["transactions:read", "roznamcha:read"],
    createPerms: ["transactions:create", "roznamcha:create"],
    editPerms: ["transactions:update"],
    deletePerms: [],
    approvePerms: ["transactions:post"],
    exportPerms: ["reports:export"]
  },
  {
    key: "bank_accounts",
    name: "Bank Accounts & Reconciliation",
    category: "Finance & Accounting",
    viewPerms: ["banks:read", "accounts:read"],
    createPerms: ["banks:create"],
    editPerms: ["banks:update"],
    deletePerms: ["banks:delete"],
    approvePerms: ["accounts:post"],
    exportPerms: ["reports:export"]
  },
  {
    key: "uae_tax_einvoicing",
    name: "UAE Tax, VAT & e-Invoicing",
    category: "Finance & Accounting",
    viewPerms: ["uae_tax:read"],
    createPerms: ["uae_tax:write", "uae_tax_settings:write"],
    editPerms: ["uae_tax:write", "uae_tax_settings:write"],
    deletePerms: [],
    approvePerms: ["uae_tax_filing:write"],
    exportPerms: ["reports:export"]
  },

  // 2. Granular Expense Bills
  {
    key: "expenses_customer",
    name: "Customer Expense Bills Register",
    category: "Finance & Accounting",
    viewPerms: ["expenses_customer:read", "expenses:read", "route:/dashboard/clearing-agent/customer-expenses"],
    createPerms: ["expenses_customer:create", "expenses:create"],
    editPerms: ["expenses_customer:update", "expenses:update"],
    deletePerms: ["expenses_customer:delete", "expenses:delete"],
    approvePerms: ["expenses_customer:approve", "expenses:post"],
    exportPerms: ["expenses_customer:export", "reports:export"]
  },
  {
    key: "expenses_customs",
    name: "Customs Expense Bills Register",
    category: "Finance & Accounting",
    viewPerms: ["expenses_customs:read", "expenses:read", "route:/dashboard/clearing-agent/customs-expenses"],
    createPerms: ["expenses_customs:create", "expenses:create"],
    editPerms: ["expenses_customs:update", "expenses:update"],
    deletePerms: ["expenses_customs:delete", "expenses:delete"],
    approvePerms: ["expenses_customs:approve", "expenses:post"],
    exportPerms: ["expenses_customs:export", "reports:export"]
  },
  {
    key: "expenses_truck",
    name: "Truck Expense Bills Register",
    category: "Finance & Accounting",
    viewPerms: ["expenses_truck:read", "expenses:read", "route:/dashboard/clearing-agent/truck-expenses"],
    createPerms: ["expenses_truck:create", "expenses:create"],
    editPerms: ["expenses_truck:update", "expenses:update"],
    deletePerms: ["expenses_truck:delete", "expenses:delete"],
    approvePerms: ["expenses_truck:approve", "expenses:post"],
    exportPerms: ["expenses_truck:export", "reports:export"]
  },
  {
    key: "expenses_other",
    name: "Other Expense Bills Register",
    category: "Finance & Accounting",
    viewPerms: ["expenses_other:read", "expenses:read", "route:/dashboard/clearing-agent/other-expenses"],
    createPerms: ["expenses_other:create", "expenses:create"],
    editPerms: ["expenses_other:update", "expenses:update"],
    deletePerms: ["expenses_other:delete", "expenses:delete"],
    approvePerms: ["expenses_other:approve", "expenses:post"],
    exportPerms: ["expenses_other:export", "reports:export"]
  },

  // 3. Trading & Inventory
  {
    key: "purchase_booking",
    name: "Purchase Contracts, Orders & Invoices",
    category: "Trading & Inventory",
    viewPerms: ["purchases:read"],
    createPerms: ["purchases:create"],
    editPerms: ["purchases:update"],
    deletePerms: [],
    approvePerms: ["purchases:post"],
    exportPerms: ["reports:export"]
  },
  {
    key: "sales_invoicing",
    name: "Sales Contracts, Invoices & Quotations",
    category: "Trading & Inventory",
    viewPerms: ["sales:read"],
    createPerms: ["sales:create"],
    editPerms: ["sales:update"],
    deletePerms: [],
    approvePerms: ["sales:post"],
    exportPerms: ["reports:export"]
  },
  {
    key: "stock_warehouse",
    name: "Stock Inventory & Item Master",
    category: "Trading & Inventory",
    viewPerms: ["inventory:read", "products:read"],
    createPerms: ["products:create", "chs_products:create"],
    editPerms: ["products:update", "chs_products:update"],
    deletePerms: ["products:delete", "chs_products:delete"],
    approvePerms: ["inter_branch_transfers:approve"],
    exportPerms: ["chs_products:export"]
  },
  {
    key: "warehouses_transfers",
    name: "Warehouses & Inter-Branch Transfers",
    category: "Trading & Inventory",
    viewPerms: ["warehouses:read", "inventory:read"],
    createPerms: ["warehouses:create", "inter_branch_transfers:create"],
    editPerms: ["warehouses:update"],
    deletePerms: ["warehouses:delete"],
    approvePerms: ["inter_branch_transfers:approve"],
    exportPerms: ["reports:export"]
  },

  // 4. Logistics & Customs
  {
    key: "customer_orders_step_1a",
    name: "Customer Order: Customer & Route (Step 1A / E1)",
    category: "Logistics & Customs",
    viewPerms: ["customer_orders:step_1a:read", "shipping_records:read", "route:/dashboard/clearing-agent/customer-order"],
    createPerms: ["customer_orders:step_1a:create", "shipping_records:create"],
    editPerms: ["customer_orders:step_1a:update", "shipping_records:update"],
    deletePerms: ["customer_orders:step_1a:delete"],
    approvePerms: ["customer_orders:step_1a:approve"],
    exportPerms: ["customer_orders:export", "reports:export"]
  },
  {
    key: "customer_orders_step_1b",
    name: "Customer Order: Truck & Loading (Step 1B)",
    category: "Logistics & Customs",
    viewPerms: ["customer_orders:step_1b:read", "shipping_records:read"],
    createPerms: ["customer_orders:step_1b:create", "shipping_records:create"],
    editPerms: ["customer_orders:step_1b:update", "shipping_records:update"],
    deletePerms: ["customer_orders:step_1b:delete"],
    approvePerms: ["customer_orders:step_1b:approve"],
    exportPerms: ["customer_orders:export", "reports:export"]
  },
  {
    key: "customer_orders_step_1c",
    name: "Customer Order: Goods & Package (Step 1C)",
    category: "Logistics & Customs",
    viewPerms: ["customer_orders:step_1c:read", "shipping_records:read"],
    createPerms: ["customer_orders:step_1c:create", "shipping_records:create"],
    editPerms: ["customer_orders:step_1c:update", "shipping_records:update"],
    deletePerms: ["customer_orders:step_1c:delete"],
    approvePerms: ["customer_orders:step_1c:approve"],
    exportPerms: ["customer_orders:export", "reports:export"]
  },
  {
    key: "shipping_customs",
    name: "Shipping Lines, Port Customs & BL Tracking",
    category: "Logistics & Customs",
    viewPerms: ["shipping_records:read"],
    createPerms: ["shipping_records:create"],
    editPerms: ["shipping_records:update"],
    deletePerms: [],
    approvePerms: ["record_transfers:create"],
    exportPerms: ["reports:export"]
  },
  {
    key: "clearing_agents",
    name: "Clearing Agents & Port Terminals",
    category: "Logistics & Customs",
    viewPerms: ["clearing_agents:read", "clearing_agent_branches:read"],
    createPerms: ["clearing_agents:create", "clearing_agent_branches:create"],
    editPerms: ["clearing_agents:update", "clearing_agent_branches:update"],
    deletePerms: [],
    approvePerms: ["record_transfers:create"],
    exportPerms: ["reports:export"]
  },

  // 5. Administration, HR & System
  {
    key: "companies_owners",
    name: "Companies, Owners & Partners Master",
    category: "Administration, HR & System",
    viewPerms: ["companies:read"],
    createPerms: ["companies:create"],
    editPerms: ["companies:update"],
    deletePerms: ["companies:delete"],
    approvePerms: [],
    exportPerms: ["reports:export"]
  },
  {
    key: "customers_suppliers",
    name: "Customers, Suppliers & Parties Master",
    category: "Administration, HR & System",
    viewPerms: ["customers:read"],
    createPerms: ["customers:create"],
    editPerms: ["customers:update"],
    deletePerms: [],
    approvePerms: [],
    exportPerms: ["reports:export"]
  },
  {
    key: "hr_payroll",
    name: "HR & Payroll, Employees & Attendance",
    category: "Administration, HR & System",
    viewPerms: ["employees:read", "payroll:read"],
    createPerms: ["employees:create", "payroll:create"],
    editPerms: ["employees:update", "payroll:update"],
    deletePerms: ["employees:delete"],
    approvePerms: ["payroll:approve"],
    exportPerms: ["reports:export"]
  },
  {
    key: "currency_exchange",
    name: "Currency Exchange & Sarafi Rates",
    category: "Administration, HR & System",
    viewPerms: ["exchange_rates:read"],
    createPerms: ["exchange_rates:create"],
    editPerms: ["exchange_rates:update"],
    deletePerms: [],
    approvePerms: ["exchange_rates:approve"],
    exportPerms: ["reports:export"]
  },
  {
    key: "financial_reports",
    name: "Financial Reports & Analytical Statements",
    category: "Administration, HR & System",
    viewPerms: ["reports:read", "ledgers:read"],
    createPerms: [],
    editPerms: [],
    deletePerms: [],
    approvePerms: [],
    exportPerms: ["reports:export"]
  },
  {
    key: "user_management",
    name: "User Management & Role Permissions",
    category: "Administration, HR & System",
    viewPerms: ["users:read"],
    createPerms: ["users:create"],
    editPerms: ["users:update"],
    deletePerms: ["users:delete"],
    approvePerms: ["approvals:approve"],
    exportPerms: ["reports:export"]
  },
  {
    key: "system_governance",
    name: "System Settings & Audit Logs",
    category: "Administration, HR & System",
    viewPerms: ["audit_logs:read", "financial_periods:read"],
    createPerms: ["financial_periods:create"],
    editPerms: ["financial_periods:update"],
    deletePerms: [],
    approvePerms: ["approvals:approve"],
    exportPerms: ["reports:export"]
  },
  {
    key: "contract_control",
    name: "Central Contract Control Center",
    category: "Administration, HR & System",
    viewPerms: ["contracts:read"],
    createPerms: ["contracts:write"],
    editPerms: ["contracts:write"],
    deletePerms: [],
    approvePerms: ["contracts:write"],
    exportPerms: ["reports:export"]
  },

  // 6. Shipping Line User Add-ons
  {
    key: "shipping_account_ledger_access",
    name: "Shipping — Account Search, Create & Cross-Branch Posting",
    category: "Logistics & Customs",
    viewPerms: ["accounts:read"],
    createPerms: ["accounts:create"],
    editPerms: ["roznamcha:post_cross_branch"],
    deletePerms: [],
    approvePerms: ["ledger_full:read"],
    exportPerms: ["reports:export"]
  },
  {
    key: "shipping_crm_access",
    name: "Shipping — CRM Follow-Up Access",
    category: "Logistics & Customs",
    viewPerms: ["crm:read"],
    createPerms: ["crm:create"],
    editPerms: ["crm:followup"],
    deletePerms: [],
    approvePerms: [],
    exportPerms: []
  },
  {
    key: "shipping_crm_reports",
    name: "Shipping — CRM Reports (User / Branch / Country)",
    category: "Logistics & Customs",
    viewPerms: ["crm:report_user"],
    createPerms: ["crm:report_branch"],
    editPerms: ["crm:report_country"],
    deletePerms: [],
    approvePerms: [],
    exportPerms: []
  },
  {
    key: "shipping_reports_access",
    name: "Shipping — Shipping Reports",
    category: "Logistics & Customs",
    viewPerms: ["shipping_reports:read", "reports:read"],
    createPerms: [],
    editPerms: [],
    deletePerms: [],
    approvePerms: [],
    exportPerms: ["reports:export"]
  },
  {
    key: "shipping_employee_access",
    name: "Shipping — Employee Management Access",
    category: "Logistics & Customs",
    viewPerms: ["employees:read"],
    createPerms: ["employees:create"],
    editPerms: [],
    deletePerms: [],
    approvePerms: [],
    exportPerms: []
  }
];

export function getRoleDefaultPermissions(role: EnterpriseRole): string[] {
  return enterpriseRolePermissions[role] || [];
}

export function buildRbacRoleSummary(role: EnterpriseRole, customPermissions?: string[]): RbacRoleSummary {
  const isSuperAdmin = role === "super_admin";
  const userPerms = new Set<string>(customPermissions && customPermissions.length > 0 ? customPermissions : enterpriseRolePermissions[role] || []);

  const hasWildcard = isSuperAdmin || userPerms.has("*:*");

  const checkPerm = (requiredPerms: string[]) => {
    if (requiredPerms.length === 0) return false;
    if (hasWildcard) return true;
    return requiredPerms.some(p => userPerms.has(p) || userPerms.has(`${p.split(':')[0]}:*`));
  };

  const accessibleModules: ModulePermissionCapability[] = [];
  const restrictedModules: string[] = [];

  ERP_MODULE_DEFINITIONS.forEach(mod => {
    const canView = checkPerm(mod.viewPerms);
    const canCreate = checkPerm(mod.createPerms);
    const canEdit = checkPerm(mod.editPerms);
    const canDelete = checkPerm(mod.deletePerms);
    const canPostApprove = checkPerm(mod.approvePerms);
    const canPrintExport = checkPerm(mod.exportPerms);

    if (canView || canCreate || canEdit || canDelete || canPostApprove || canPrintExport) {
      accessibleModules.push({
        moduleKey: mod.key,
        moduleName: mod.name,
        category: mod.category,
        canView,
        canCreate,
        canEdit,
        canDelete,
        canPostApprove,
        canPrintExport,
        notes: canPostApprove ? "Posting & Approvals Authorized" : canCreate ? "Data Entry Authorized" : "Read-Only Access"
      });
    } else {
      restrictedModules.push(mod.name);
    }
  });

  const supervisorPrivileges: string[] = [];
  if (isSuperAdmin) {
    supervisorPrivileges.push("Full Global System Governance (No Country/Branch Restrictions)");
    supervisorPrivileges.push("Database Migration & Architecture Maintenance");
    supervisorPrivileges.push("Super Admin & Country Admin User Provisioning");
    supervisorPrivileges.push("Global Inter-Country Financial Consolidation");
  } else if (role === "country_admin") {
    supervisorPrivileges.push("Country-Wide Financial Consolidation & Ledger Audits");
    supervisorPrivileges.push("Branch Creation & Regional User Management");
    supervisorPrivileges.push("Foreign Exchange (Sarafi) Rate Overrides for Country");
  } else if (role === "main_branch_admin") {
    supervisorPrivileges.push("Main Branch Daily Book Closing & Roznamcha Approvals");
    supervisorPrivileges.push("Inter-Branch Inventory Transfer Authorizations");
    supervisorPrivileges.push("Staff Task Assignments & Voucher Review");
  } else if (role === "accountant") {
    supervisorPrivileges.push("Direct General Ledger Postings & Cash Reconciliation");
  }

  const roleTitles: Partial<Record<EnterpriseRole, string>> = {
    super_admin: "Super Administrator (Enterprise Root)",
    super_admin_reports: "Super Admin Reports Auditor",
    country_admin: "Country General Manager / Administrator",
    country_user: "Country Operations Officer",
    main_branch_admin: "Main Branch Director / Admin",
    city_branch_admin: "City Branch Manager",
    accountant: "Branch Chief Accountant",
    cashier: "Cashier / Payments Officer",
    agent_user: "Customs & Clearing Agent",
    staff_user: "Operations Staff User",
    auditor_viewer: "Auditor / Compliance Viewer",
    global_operations_admin: "Global Operations Administrator (no Finance)",
    country_operations_admin: "Country Operations Administrator (no Finance)",
    city_operations_admin: "City Branch Operations Administrator (no Finance)",
    shipping_line_admin: "Shipping Line Administrator",
    shipping_line_user: "Shipping Line User"
  };

  return {
    role,
    roleTitle: roleTitles[role] || role,
    scopeDescription: enterpriseRoleScopes[role] || "Assigned Scope",
    isSuperAdmin,
    accessibleModules,
    restrictedModules,
    supervisorPrivileges
  };
}

export function buildAllModulesCapabilities(role: EnterpriseRole, activePermissions: string[]): ModulePermissionCapability[] {
  const isSuperAdmin = role === "super_admin";
  const userPerms = new Set<string>(activePermissions);
  const hasWildcard = isSuperAdmin || userPerms.has("*:*");

  const checkPerm = (requiredPerms: string[]) => {
    if (requiredPerms.length === 0) return false;
    if (hasWildcard) return true;
    return requiredPerms.some(p => userPerms.has(p) || userPerms.has(`${p.split(':')[0]}:*`));
  };

  return ERP_MODULE_DEFINITIONS.map(mod => ({
    moduleKey: mod.key,
    moduleName: mod.name,
    category: mod.category,
    canView: checkPerm(mod.viewPerms),
    canCreate: checkPerm(mod.createPerms),
    canEdit: checkPerm(mod.editPerms),
    canDelete: checkPerm(mod.deletePerms),
    canPostApprove: checkPerm(mod.approvePerms),
    canPrintExport: checkPerm(mod.exportPerms),
    notes: checkPerm(mod.approvePerms) ? "Posting & Approvals Authorized" : checkPerm(mod.createPerms) ? "Data Entry Authorized" : checkPerm(mod.viewPerms) ? "Read-Only Access" : "No Access"
  }));
}

/**
 * 4-Tier Interactive Matrix State Map:
 * Record<formKey, Record<ErpActionKey, boolean>>
 */
export type HierarchicalMatrixState = Record<string, Record<ErpActionKey, boolean>>;

/**
 * Builds the initial 4-tier interactive state from role defaults or user permissions.
 */
export function buildHierarchicalMatrixState(role: EnterpriseRole, activePermissions: string[]): HierarchicalMatrixState {
  const isSuperAdmin = role === "super_admin";
  const userPerms = new Set<string>(activePermissions);
  const hasWildcard = isSuperAdmin || userPerms.has("*:*");

  const checkPerms = (requiredPerms: string[]) => {
    if (requiredPerms.length === 0) return false;
    if (hasWildcard) return true;
    return requiredPerms.some(p => userPerms.has(p) || userPerms.has(`${p.split(':')[0]}:*`));
  };

  const state: HierarchicalMatrixState = {};

  for (const mod of ERP_PERMISSION_HIERARCHY) {
    for (const sec of mod.sections) {
      for (const form of sec.forms) {
        state[form.key] = {
          view: checkPerms(form.actions.view),
          create: checkPerms(form.actions.create),
          edit: checkPerms(form.actions.edit),
          delete: checkPerms(form.actions.delete),
          submit_transfer: checkPerms(form.actions.submit_transfer),
          approve: checkPerms(form.actions.approve),
          print: checkPerms(form.actions.print),
          export: checkPerms(form.actions.export)
        };
      }
    }
  }

  return state;
}

/**
 * Converts 4-tier interactive state or module capabilities array into granular database permission tokens.
 * Crucially: selecting a module or action NEVER adds wildcard "*:*" or unauthorized parent tokens.
 */
export function convertMatrixToPermissions(
  role: EnterpriseRole,
  capabilitiesOrState: ModulePermissionCapability[] | HierarchicalMatrixState
): string[] {
  if (role === "super_admin") {
    return ["*:*"];
  }

  const result = new Set<string>();

  // If passed hierarchical matrix state map:
  if (!Array.isArray(capabilitiesOrState)) {
    const state = capabilitiesOrState;
    for (const mod of ERP_PERMISSION_HIERARCHY) {
      for (const sec of mod.sections) {
        for (const form of sec.forms) {
          const formState = state[form.key];
          if (!formState) continue;

          for (const actionKey of ERP_ACTION_KEYS) {
            if (formState[actionKey]) {
              const tokens = form.actions[actionKey] || [];
              for (const token of tokens) {
                result.add(token);
              }
            }
          }
        }
      }
    }
    return Array.from(result);
  }

  // If passed legacy ModulePermissionCapability array:
  capabilitiesOrState.forEach(cap => {
    const def = ERP_MODULE_DEFINITIONS.find(d => d.key === cap.moduleKey);
    if (!def) return;

    if (cap.canView) def.viewPerms.forEach(p => result.add(p));
    if (cap.canCreate) def.createPerms.forEach(p => result.add(p));
    if (cap.canEdit) def.editPerms.forEach(p => result.add(p));
    if (cap.canDelete) def.deletePerms.forEach(p => result.add(p));
    if (cap.canPostApprove) def.approvePerms.forEach(p => result.add(p));
    if (cap.canPrintExport) def.exportPerms.forEach(p => result.add(p));
  });

  return Array.from(result);
}
