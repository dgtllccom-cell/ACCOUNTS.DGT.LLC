import type { EnterpriseRole } from "./enterprise-roles.ts";
import { enterpriseRolePermissions, enterpriseRoleScopes } from "./enterprise-roles.ts";

export interface ModulePermissionCapability {
  moduleKey: string;
  moduleName: string;
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

export const ERP_MODULE_DEFINITIONS: Array<{
  key: string;
  name: string;
  category: "Finance & Accounting" | "Trading & Inventory" | "Logistics & Customs" | "Administration & System";
  viewPerms: string[];
  createPerms: string[];
  editPerms: string[];
  deletePerms: string[];
  approvePerms: string[];
  exportPerms: string[];
}> = [
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
    key: "general_ledgers",
    name: "General & Branch Ledgers",
    category: "Finance & Accounting",
    viewPerms: ["ledgers:read", "reports:read"],
    createPerms: ["ledgers:create", "journal_entries:create"],
    editPerms: ["ledgers:update"],
    deletePerms: ["ledgers:delete"],
    approvePerms: ["ledgers:post", "journal_entries:post"],
    exportPerms: ["reports:export"]
  },
  {
    key: "purchase_booking",
    name: "Purchase Booking & Orders",
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
    name: "Sales Contracts & Invoices",
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
    name: "Stock Movements & Warehouse Inventory",
    category: "Trading & Inventory",
    viewPerms: ["inventory:read", "warehouses:read", "products:read"],
    createPerms: ["products:create", "warehouses:create", "chs_products:create"],
    editPerms: ["products:update", "warehouses:update", "chs_products:update"],
    deletePerms: ["products:delete", "chs_products:delete"],
    approvePerms: ["inter_branch_transfers:approve"],
    exportPerms: ["chs_products:export"]
  },
  {
    key: "shipping_customs",
    name: "Shipping Lines & Port Customs",
    category: "Logistics & Customs",
    viewPerms: ["shipping_records:read", "clearing_agents:read", "clearing_agent_branches:read"],
    createPerms: ["shipping_records:create", "clearing_agent_branches:create"],
    editPerms: ["shipping_records:update", "clearing_agent_branches:update"],
    deletePerms: [],
    approvePerms: ["record_transfers:create"],
    exportPerms: ["reports:export"]
  },
  {
    key: "companies_customers",
    name: "Companies, Banks & Customer Masters",
    category: "Administration & System",
    viewPerms: ["companies:read", "banks:read", "customers:read"],
    createPerms: ["companies:create", "banks:create", "customers:create"],
    editPerms: ["companies:update", "banks:update", "customers:update"],
    deletePerms: ["companies:delete"],
    approvePerms: [],
    exportPerms: ["reports:export"]
  },
  {
    key: "user_management",
    name: "User Management & Role Permissions",
    category: "Administration & System",
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
    category: "Administration & System",
    viewPerms: ["audit_logs:read", "financial_periods:read"],
    createPerms: ["financial_periods:create"],
    editPerms: ["financial_periods:update"],
    deletePerms: [],
    approvePerms: ["approvals:approve"],
    exportPerms: ["reports:export"]
  }
];

export function buildRbacRoleSummary(role: EnterpriseRole): RbacRoleSummary {
  const isSuperAdmin = role === "super_admin";
  const userPerms = new Set<string>(enterpriseRolePermissions[role] || []);

  const hasWildcard = isSuperAdmin || userPerms.has("*:*");

  const checkPerm = (requiredPerms: string[]) => {
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

    if (canView || canCreate || canEdit || canDelete || canPostApprove) {
      accessibleModules.push({
        moduleKey: mod.key,
        moduleName: mod.name,
        canView,
        canCreate,
        canEdit,
        canDelete,
        canPostApprove,
        canPrintExport,
        notes: canPostApprove ? "Authorized for Financial Posting" : canCreate ? "Data Entry Authorized" : "Read-Only Access"
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
