import type { EnterpriseRole } from "./enterprise-roles";
import { enterpriseRolePermissions, enterpriseRoleScopes } from "./enterprise-roles";

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
}

export const ERP_MODULE_DEFINITIONS: ErpModuleDef[] = [
  // 1. Finance & Accounting
  {
    key: "chart_of_accounts",
    name: "Chart of Accounts & Multi-Linking",
    category: "Finance & Accounting",
    viewPerms: ["accounts:read", "ledgers:read"],
    createPerms: ["accounts:create"],
    editPerms: ["accounts:update"],
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

  // 2. Trading & Inventory
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

  // 3. Logistics & Customs
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

  // 4. Administration, HR & System
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

  const roleTitles: Record<EnterpriseRole, string> = {
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
    auditor_viewer: "Auditor / Compliance Viewer"
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

export function convertMatrixToPermissions(role: EnterpriseRole, capabilities: ModulePermissionCapability[]): string[] {
  if (role === "super_admin") {
    return ["*:*"];
  }

  const result = new Set<string>();

  capabilities.forEach(cap => {
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
