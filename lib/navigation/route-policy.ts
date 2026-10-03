/**
 * Route access policy — the ONE place that decides which /dashboard route a login may open.
 *
 * Used by (1) the sidebar (what to show), (2) the dashboard frame (client guard) and (3) the dashboard layout on the SERVER
 * (so a pasted URL fails with a 403 page, not just a hidden menu entry). It is pure: no React, no DB.
 *
 * Rules
 *  - Super Admin passes everything.
 *  - A route passes when the login holds ANY token its map entry lists (a permission, a role name or a route:<path> grant).
 *  - The most specific (longest) mapped prefix decides for sub-pages.
 *  - Operations / shipping-line logins (roles that are ALL non-financial) are STRICT: financial prefixes are denied outright and
 *    any route the map does not cover is denied (default deny). Every other login keeps the legacy default-allow for unmapped
 *    pages (their data is still protected by the API permission + scope checks).
 */
import { NON_FINANCIAL_ROLES } from "@/lib/permissions/enterprise-roles";

const BASE_ROUTE_PERMISSION_MAP: Record<string, string[]> = {
  "/dashboard": ["dashboard:read", "route:/dashboard"],
  "/dashboard/smart-operations": ["dashboard:read", "route:/dashboard/smart-operations"],
  "/dashboard/ai-assistant": ["dashboard:read", "route:/dashboard/ai-assistant"],
  // the global dashboard: Super Admin only (dashboard:read used to let every login through to the page's own redirect)
  "/dashboard/super-admin": ["super_admin", "route:/dashboard/super-admin"],
  "/dashboard/country": ["dashboard:read", "country_admin", "country_user", "route:/dashboard/country"],
  "/dashboard/city": ["dashboard:read", "main_branch_admin", "city_branch_admin", "staff_user", "accountant", "cashier", "route:/dashboard/city"],
  "/dashboard/logistics": ["shipping_records:read", "route:/dashboard/logistics"],
  "/dashboard/new-entry/users/registration": ["users:create", "users:read", "route:/dashboard/new-entry/users/registration"],
  "/dashboard/new-entry/users/all": ["users:read", "route:/dashboard/new-entry/users/all"],
  "/dashboard/new-entry/users/credentials-pdf": ["super_admin", "route:/dashboard/new-entry/users/credentials-pdf"],
  "/dashboard/new-entry/branch-entry/country-branch": ["country_branches:create", "country_branches:read", "route:/dashboard/new-entry/branch-entry/country-branch"],
  "/dashboard/new-entry/branch-entry/city-branch": ["city_branches:create", "city_branches:read", "route:/dashboard/new-entry/branch-entry/city-branch"],
  "/dashboard/new-entry/branches/super-admin": ["country_branches:create", "super_admin", "route:/dashboard/new-entry/branches/super-admin"],
  "/dashboard/branch-management/general-report": ["country_branches:read", "city_branches:read", "route:/dashboard/branch-management/general-report"],
  "/dashboard/accounts/setup": ["accounts:read", "accounts:create", "accounts:update", "accounts.setup", "accounts.new_entry", "route:/dashboard/accounts/setup"],
  "/dashboard/ledger/new": ["ledgers:read", "ledgers:create", "ledgers.new", "route:/dashboard/ledger/new"],
  "/dashboard/new-entry/accounts/general-report": ["accounts:read", "accounts.reports", "reports:read", "route:/dashboard/new-entry/accounts/general-report"],
  "/dashboard/new-entry": ["super_admin", "country_admin", "main_branch_admin", "city_branch_admin", "route:/dashboard/new-entry"],
  "/dashboard/business-edit-invoice": ["transactions:update", "purchases:update", "route:/dashboard/business-edit-invoice"],
  "/dashboard/super-admin/edit-history": ["transactions:read", "audit_logs:read", "super_admin", "route:/dashboard/super-admin/edit-history"],
  "/dashboard/super-admin/deleted-records": ["transactions:read", "audit_logs:read", "super_admin", "country_admin", "route:/dashboard/super-admin/deleted-records"],
  "/dashboard/ledger/detailed": ["ledgers:read", "route:/dashboard/ledger/detailed"],
  "/dashboard/ledger/general-report": ["ledgers:read", "reports:read", "route:/dashboard/ledger/general-report"],
  "/dashboard/ledger/outstanding": ["ledgers:read", "reports:read", "route:/dashboard/ledger/outstanding"],
  "/dashboard/roznamcha/cash-entry": ["roznamcha:read", "roznamcha:create", "route:/dashboard/roznamcha/cash-entry"],
  "/dashboard/journal/purchase-order-payment/advance": ["transactions:read", "purchases:read", "route:/dashboard/journal/purchase-order-payment/advance"],
  "/dashboard/journal/purchase-order-payment/charges": ["transactions:read", "purchases:read", "route:/dashboard/journal/purchase-order-payment/charges"],
  "/dashboard/journal/purchase-order-payment/remaining": ["transactions:read", "purchases:read", "route:/dashboard/journal/purchase-order-payment/remaining"],
  "/dashboard/journal/purchase-order-payment/history": ["transactions:read", "purchases:read", "route:/dashboard/journal/purchase-order-payment/history"],
  "/dashboard/journal/purchase-order-payment/final": ["transactions:read", "purchases:read", "route:/dashboard/journal/purchase-order-payment/final"],
  "/dashboard/journal/sales-order-payment/advance": ["transactions:read", "sales:read", "route:/dashboard/journal/sales-order-payment/advance"],
  "/dashboard/journal/sales-order-payment/charges": ["transactions:read", "sales:read", "route:/dashboard/journal/sales-order-payment/charges"],
  "/dashboard/journal/sales-order-payment/remaining": ["transactions:read", "sales:read", "route:/dashboard/journal/sales-order-payment/remaining"],
  "/dashboard/journal/sales-order-payment/history": ["transactions:read", "sales:read", "route:/dashboard/journal/sales-order-payment/history"],
  "/dashboard/journal/sales-order-payment/final": ["transactions:read", "sales:read", "route:/dashboard/journal/sales-order-payment/final"],
  "/dashboard/roznamcha/daily-expenses-bill": ["expenses:read", "expenses:create", "route:/dashboard/roznamcha/daily-expenses-bill"],
  "/dashboard/roznamcha/expenses-bill": ["expenses:read", "expenses:create", "route:/dashboard/roznamcha/expenses-bill"],
  "/dashboard/purchase/new-purchase-booking-order": ["purchases:read", "purchases:create", "route:/dashboard/purchase/new-purchase-booking-order"],
  "/dashboard/purchase/purchase-confirm": ["purchases:read", "purchases:update", "route:/dashboard/purchase/purchase-confirm"],
  "/dashboard/purchase/purchase-booking-journal-report": ["purchases:read", "reports:read", "route:/dashboard/purchase/purchase-booking-journal-report"],
  "/dashboard/purchase/purchase-order": ["purchases:read", "purchases:create", "route:/dashboard/purchase/purchase-order"],
  "/dashboard/purchase/purchase-order-tracking": ["purchases:read", "route:/dashboard/purchase/purchase-order-tracking"],
  "/dashboard/purchase/completed-purchase-bills": ["purchases:read", "route:/dashboard/purchase/completed-purchase-bills"],
  "/dashboard/purchase/purchase-loading-records": ["purchases:read", "purchases:update", "purchase_logistics:read", "route:/dashboard/purchase/purchase-loading-records"],
  "/dashboard/purchase/purchase-transit-lane": ["purchases:read", "purchase_logistics:read", "route:/dashboard/purchase/purchase-transit-lane"],
  "/dashboard/purchase/local-purchase": ["purchases:read", "purchases:create", "route:/dashboard/purchase/local-purchase"],
  "/dashboard/purchase/local-goods-received": ["purchases:read", "inventory:read", "route:/dashboard/purchase/local-goods-received"],
  "/dashboard/purchase/local-purchase-transfer-payment": ["purchases:read", "transactions:read", "route:/dashboard/purchase/local-purchase-transfer-payment"],
  "/dashboard/purchase/local-purchase-warehouse-transfer": ["purchases:read", "warehouses:read", "route:/dashboard/purchase/local-purchase-warehouse-transfer"],
  "/dashboard/purchase/local-purchase-loading": ["purchases:read", "route:/dashboard/purchase/local-purchase-loading"],
  "/dashboard/purchase/local-purchase-export": ["purchases:read", "shipping_records:read", "route:/dashboard/purchase/local-purchase-export"],
  "/dashboard/purchase/local-purchase-journal-report": ["purchases:read", "reports:read", "route:/dashboard/purchase/local-purchase-journal-report"],
  "/dashboard/consignment": ["purchases:read", "inventory:read", "route:/dashboard/consignment"],
  "/dashboard/sales/new-sales-booking-order": ["sales:read", "sales:create", "route:/dashboard/sales/new-sales-booking-order"],
  "/dashboard/sales/sales-confirm": ["sales:read", "sales:update", "route:/dashboard/sales/sales-confirm"],
  "/dashboard/sales/sales-booking-journal-report": ["sales:read", "reports:read", "route:/dashboard/sales/sales-booking-journal-report"],
  "/dashboard/sales/local-sales": ["sales:read", "sales:create", "route:/dashboard/sales/local-sales"],
  "/dashboard/sales/sales-order": ["sales:read", "sales:create", "route:/dashboard/sales/sales-order"],
  "/dashboard/purchase/country-transfer": ["purchases:read", "shipping_transfers:read", "route:/dashboard/purchase/country-transfer"],
  "/dashboard/inter-country-transfers": ["purchases:read", "shipping_records:read", "shipping_transfers:read", "route:/dashboard/inter-country-transfers"],
  "/dashboard/purchase/country-purchase-reports": ["purchases:read", "reports:read", "route:/dashboard/purchase/country-purchase-reports"],
  "/dashboard/bill-cost-profit": ["purchases:read", "expenses:read", "route:/dashboard/bill-cost-profit"],
  "/dashboard/expenses/bill-expenses": ["expenses:read", "expenses:create", "route:/dashboard/expenses/bill-expenses"],
  "/dashboard/inventory": ["products:read", "inventory:read", "route:/dashboard/inventory"],
  "/dashboard/clearing-agent/customer-order": ["shipping_records:read", "clearing_agents:read", "route:/dashboard/clearing-agent/customer-order"],
  "/dashboard/clearing-agent/customer-bill": ["shipping_records:read", "clearing_bill_customer_charges:read", "route:/dashboard/clearing-agent/customer-bill"],
  "/dashboard/shipping-line": ["shipping_records:read", "route:/dashboard/shipping-line"],
  "/dashboard/shipping-line/bl-entry": ["shipping_records:read", "route:/dashboard/shipping-line/bl-entry"],
  "/dashboard/shipping-line/tracking": ["shipping_records:read", "route:/dashboard/shipping-line/tracking"],
  "/dashboard/purchase/shipment-tracking": ["purchases:read", "route:/dashboard/purchase/shipment-tracking"],
  "/dashboard/tracking": ["dashboard:read", "shipping_records:read", "route:/dashboard/tracking"],
  "/dashboard/clearing-agent": ["clearing_agents:read", "route:/dashboard/clearing-agent"],
  "/dashboard/clearing-agent/truck-registration": ["shipping_records:read", "clearing_agents:read", "route:/dashboard/clearing-agent/truck-registration"],
  "/dashboard/shipping-line/handover-inbox": ["shipping_records:read", "shipping_transfers:read", "route:/dashboard/shipping-line/handover-inbox"],
  "/dashboard/shipping-line/account-access": ["accounts:read", "route:/dashboard/shipping-line/account-access"],
  "/dashboard/settings/bank": ["banks:read", "route:/dashboard/settings/bank"],
  "/dashboard/roznamcha/reports/bank": ["banks:read", "roznamcha:read", "route:/dashboard/roznamcha/reports/bank"],
  "/dashboard/roznamcha/money-exchange": ["exchange_rates:read", "route:/dashboard/roznamcha/money-exchange"],
  "/dashboard/reports/exchange-rate": ["exchange_rates:read", "route:/dashboard/reports/exchange-rate"],
  "/dashboard/super-admin/investments": ["transactions:read", "super_admin", "route:/dashboard/super-admin/investments"],
  "/dashboard/settings/customers": ["customers:read", "route:/dashboard/settings/customers"],
  "/dashboard/general-office/employees": ["users:read", "employees:read", "route:/dashboard/general-office/employees"],
  "/dashboard/general-office/employee-kyc": ["users:read", "employees:read", "route:/dashboard/general-office/employee-kyc"],
  "/dashboard/general-office/leave-attendance": ["users:read", "employees:read", "route:/dashboard/general-office/leave-attendance"],
  "/dashboard/general-office/payroll": ["users:read", "payroll:read", "route:/dashboard/general-office/payroll"],
  "/dashboard/general-office/wps-sif": ["users:read", "payroll:read", "route:/dashboard/general-office/wps-sif"],
  "/dashboard/general-office/performance": ["users:read", "employees:read", "tasks:read", "dashboard:read", "country_admin", "country_user", "main_branch_admin", "city_branch_admin", "city_branch_user", "hr_admin", "hr_manager", "route:/dashboard/general-office/performance"],
  "/dashboard/general-office/departments": ["users:read", "route:/dashboard/general-office/departments"],
  "/dashboard/general-office/gratuity": ["users:read", "payroll:read", "route:/dashboard/general-office/gratuity"],
  "/dashboard/settlement": ["transactions:read", "route:/dashboard/settlement"],
  "/dashboard/settlement/daily": ["transactions:read", "route:/dashboard/settlement/daily"],
  "/dashboard/settlement/payment": ["transactions:read", "route:/dashboard/settlement/payment"],
  "/dashboard/reports": ["reports:read", "route:/dashboard/reports"],
  "/dashboard/audit-monitoring": ["audit_logs:read", "route:/dashboard/audit-monitoring"],
  "/dashboard/documents": ["documents:read", "route:/dashboard/documents"],
  "/dashboard/ai-entry/messages": ["communication:read", "route:/dashboard/ai-entry/messages"],
  "/dashboard/ai-entry/voice-text": ["communication:read", "route:/dashboard/ai-entry/voice-text"],
  "/dashboard/messages/whatsapp": ["communication:read", "whatsapp:read", "route:/dashboard/messages/whatsapp"],
  "/dashboard/messages/email": ["communication:read", "route:/dashboard/messages/email"],
  "/dashboard/settings/email-accounts": ["communication:read", "settings:read", "route:/dashboard/settings/email-accounts"],
  "/dashboard/settings/super-admin-security": ["super_admin", "route:/dashboard/settings/super-admin-security"],
  "/dashboard/mail-management": ["communication:read", "route:/dashboard/mail-management"],
  "/dashboard/mail-management/users": ["users:read", "communication:read", "route:/dashboard/mail-management/users"],
  "/dashboard/mail-management/monitoring": ["audit_logs:read", "route:/dashboard/mail-management/monitoring"],
  "/dashboard/permissions/control-center": ["super_admin", "permissions:read", "route:/dashboard/permissions/control-center"],
  "/dashboard/reports/journal": ["reports:read", "ledgers:read", "route:/dashboard/reports/journal"],
  "/dashboard/bill-cost-profit/purchase": ["purchases:read", "expenses:read", "route:/dashboard/bill-cost-profit/purchase"],
  "/dashboard/bill-cost-profit/sales": ["sales:read", "expenses:read", "route:/dashboard/bill-cost-profit/sales"],
  "/dashboard/bill-cost-profit/expenses": ["expenses:read", "route:/dashboard/bill-cost-profit/expenses"],
  "/dashboard/bill-cost-profit/reports": ["reports:read", "expenses:read", "route:/dashboard/bill-cost-profit/reports"],
  "/dashboard/inventory/stock-reports/branch": ["inventory:read", "products:read", "route:/dashboard/inventory/stock-reports/branch"],
  "/dashboard/inventory/stock-reports/country": ["inventory:read", "products:read", "route:/dashboard/inventory/stock-reports/country"],
  "/dashboard/inventory/stock-reports/salesman": ["inventory:read", "products:read", "route:/dashboard/inventory/stock-reports/salesman"],
  "/dashboard/purchase/stock/warehouse": ["inventory:read", "purchases:read", "warehouses:read", "route:/dashboard/purchase/stock/warehouse"],
  "/dashboard/purchase/stock/booking": ["purchases:read", "inventory:read", "route:/dashboard/purchase/stock/booking"],
  "/dashboard/purchase/stock/confirmed": ["purchases:read", "inventory:read", "route:/dashboard/purchase/stock/confirmed"],
  "/dashboard/purchase/stock/import": ["purchases:read", "shipping_records:read", "route:/dashboard/purchase/stock/import"],
  "/dashboard/purchase/stock/in-transit": ["purchases:read", "shipping_records:read", "route:/dashboard/purchase/stock/in-transit"],
  "/dashboard/inventory/journal-report/branch": ["inventory:read", "reports:read", "route:/dashboard/inventory/journal-report/branch"],
  "/dashboard/clearing-agent/clearing-workspace": ["shipping_records:read", "clearing_agents:read", "route:/dashboard/clearing-agent/clearing-workspace"],
  "/dashboard/transfer-center": ["shipping_transfers:read", "shipping_records:read", "route:/dashboard/transfer-center"],
  "/dashboard/user-tasks": ["tasks:read", "dashboard:read", "route:/dashboard/user-tasks"],
  "/dashboard/reports/super-admin": ["super_admin", "reports:read", "route:/dashboard/reports/super-admin"],
  "/dashboard/reports/country": ["country_admin", "reports:read", "route:/dashboard/reports/country"],
  "/dashboard/reports/branch": ["reports:read", "route:/dashboard/reports/branch"],
  "/dashboard/reports/payments": ["reports:read", "transactions:read", "route:/dashboard/reports/payments"],
  "/dashboard/reports/shipping": ["reports:read", "shipping_reports:read", "shipping_records:read", "route:/dashboard/reports/shipping"],
  "/dashboard/reports/financial-statements": ["reports:read", "ledgers:read", "route:/dashboard/reports/financial-statements"],
  "/dashboard/reports/handover": ["reports:read", "shipping_transfers:read", "route:/dashboard/reports/handover"],
  "/dashboard/reports/system-forms-directory": ["reports:read", "dashboard:read", "route:/dashboard/reports/system-forms-directory"],
  "/dashboard/ai-entry/approvals": ["approvals:read", "approvals:approve", "route:/dashboard/ai-entry/approvals"],
  "/dashboard/customer-inquiries/calls": ["communication:read", "customers:read", "route:/dashboard/customer-inquiries/calls"],
  "/dashboard/document-intelligence": ["documents:read", "route:/dashboard/document-intelligence"],
  "/dashboard/crm": ["customers:read", "crm:read", "route:/dashboard/crm"],
  "/dashboard/smart-due": ["smart_due:read", "dashboard:read", "route:/dashboard/smart-due"],
  "/dashboard/crm/customers/new": ["customers:create", "customers:read", "route:/dashboard/crm/customers/new"],
  "/dashboard/crm/reports": ["reports:read", "customers:read", "route:/dashboard/crm/reports"],
  "/dashboard/tax-einvoicing/uae/dashboard": ["uae_tax:read", "route:/dashboard/tax-einvoicing/uae/dashboard"],
  "/dashboard/tax-einvoicing/uae/vat-return": ["uae_tax:read", "uae_tax_filing:read", "route:/dashboard/tax-einvoicing/uae/vat-return"],
  "/dashboard/tax-einvoicing/uae/corporate-tax": ["uae_tax:read", "uae_tax_filing:read", "route:/dashboard/tax-einvoicing/uae/corporate-tax"],
  "/dashboard/tax-einvoicing/uae/e-invoices": ["uae_tax:read", "route:/dashboard/tax-einvoicing/uae/e-invoices"],
  "/dashboard/tax-einvoicing/uae/asp-fta-status": ["uae_tax:read", "route:/dashboard/tax-einvoicing/uae/asp-fta-status"],
  "/dashboard/tax-einvoicing/uae/vat-control": ["uae_tax:read", "route:/dashboard/tax-einvoicing/uae/vat-control"],
  "/dashboard/tax-einvoicing/uae/tax-reports": ["uae_tax:read", "reports:read", "route:/dashboard/tax-einvoicing/uae/tax-reports"],
  "/dashboard/settings/goods-master": ["products:read", "inventory:read", "goods:read", "route:/dashboard/settings/goods-master"],
  "/dashboard/settings/product-categories": ["product_categories:read", "products:read", "route:/dashboard/settings/product-categories"],
  "/dashboard/settings/warehouse": ["warehouses:read", "route:/dashboard/settings/warehouse"],
  "/dashboard/communication-center": ["communication:read", "messages:read", "route:/dashboard/communication-center"],
  "/dashboard/customer-inquiries": ["communication:read", "customers:read", "route:/dashboard/customer-inquiries"],
  "/dashboard/customer-inquiries/follow-ups": ["communication:read", "customers:read", "route:/dashboard/customer-inquiries/follow-ups"],
  "/dashboard/customer-inquiries/intelligence": ["communication:read", "customers:read", "route:/dashboard/customer-inquiries/intelligence"],
  "/dashboard/customer-inquiries/reactivation": ["communication:read", "customers:read", "route:/dashboard/customer-inquiries/reactivation"],
  "/dashboard/return-sms-reply": ["communication:read", "messages:read", "route:/dashboard/return-sms-reply"],
  "/dashboard/settings": ["settings:read", "route:/dashboard/settings"],
  "/dashboard/settings/dashboard-settings": ["settings:read", "route:/dashboard/settings/dashboard-settings"],
  "/dashboard/settings/company-setup": ["companies:update", "companies:read", "route:/dashboard/settings/company-setup"],
  "/dashboard/settings/account-type": ["accounts:read", "settings:read", "route:/dashboard/settings/account-type"],
  "/dashboard/settings/locations": ["countries:read", "settings:read", "route:/dashboard/settings/locations"],
  "/dashboard/settings/tax": ["uae_tax:read", "settings:read", "route:/dashboard/settings/tax"],
  "/dashboard/settings/translations": ["translations:read", "settings:read", "route:/dashboard/settings/translations"],
  "/dashboard/settings/profile": ["profile:read", "users:read", "route:/dashboard/settings/profile"],
  "/dashboard/temp-bills/purchase": ["purchases:read", "route:/dashboard/temp-bills/purchase"],
  "/dashboard/temp-bills/sales": ["sales:read", "route:/dashboard/temp-bills/sales"],
  "/dashboard/temp-bills": ["purchases:read", "sales:read", "route:/dashboard/temp-bills"],
  "/dashboard/temp-bills/reports": ["purchases:read", "sales:read", "reports:read", "route:/dashboard/temp-bills/reports"]
};

/** Parent entries appended AFTER the specific ones: they cover sub-pages that previously had no entry at all. */
export const EXTRA_ROUTE_PERMISSIONS: Record<string, string[]> = {
  "/dashboard/ledger": ["ledgers:read", "route:/dashboard/ledger"],
  "/dashboard/roznamcha": ["roznamcha:read", "route:/dashboard/roznamcha"],
  "/dashboard/accounts": ["accounts:read", "route:/dashboard/accounts"],
  "/dashboard/journal": ["transactions:read", "purchases:read", "sales:read", "route:/dashboard/journal"],
  "/dashboard/tax-einvoicing": ["uae_tax:read", "pk_tax:read", "route:/dashboard/tax-einvoicing"],
  "/dashboard/tax": ["uae_tax:read", "pk_tax:read", "route:/dashboard/tax"],
  // NOT purchase_logistics: the parent prefix would open every unmapped purchase page (prices, payables) to an operations login;
  // Loading and Transit & Lane are mapped individually above.
  "/dashboard/purchase": ["purchases:read", "route:/dashboard/purchase"],
  "/dashboard/purchases": ["purchases:read", "route:/dashboard/purchases"],
  "/dashboard/purchase-loading-records": ["purchases:read", "purchase_logistics:read", "route:/dashboard/purchase-loading-records"],
  "/dashboard/sales": ["sales:read", "route:/dashboard/sales"],
  "/dashboard/stock": ["inventory:read", "route:/dashboard/stock"],
  "/dashboard/loading": ["shipping_records:read", "purchase_logistics:read", "route:/dashboard/loading"],
  "/dashboard/users": ["users:read", "route:/dashboard/users"],
  "/dashboard/employees": ["employees:read", "users:read", "route:/dashboard/employees"],
  "/dashboard/general-office": ["users:read", "employees:read", "payroll:read", "route:/dashboard/general-office"],
  "/dashboard/companies": ["companies:read", "route:/dashboard/companies"],
  "/dashboard/customers": ["customers:read", "route:/dashboard/customers"],
  "/dashboard/handovers": ["shipping_transfers:read", "record_transfers:read", "route:/dashboard/handovers"],
  "/dashboard/handover-report": ["shipping_transfers:read", "record_transfers:read", "route:/dashboard/handover-report"],
  "/dashboard/audit": ["audit_logs:read", "route:/dashboard/audit"],
  "/dashboard/all-release-entries": ["super_admin", "route:/dashboard/all-release-entries"],
  "/dashboard/branch-management": ["country_branches:read", "city_branches:read", "route:/dashboard/branch-management"],
  "/dashboard/clearing-agents": ["clearing_agents:read", "route:/dashboard/clearing-agents"],
  "/dashboard/shipping-lines": ["shipping_records:read", "route:/dashboard/shipping-lines"],
  "/dashboard/shipping": ["shipping_records:read", "route:/dashboard/shipping"],
  "/dashboard/kyc-reports": ["kyc:read", "route:/dashboard/kyc-reports"],
  "/dashboard/system-report": ["super_admin", "route:/dashboard/system-report"],
  "/dashboard/data": ["super_admin", "route:/dashboard/data"],
  "/dashboard/super": ["super_admin", "route:/dashboard/super"],
  "/dashboard/qvc": ["reports:read", "route:/dashboard/qvc"],
  "/dashboard/dgt-mail-management": ["communication:read", "route:/dashboard/dgt-mail-management"],
  "/dashboard/email": ["communication:read", "route:/dashboard/email"],
  "/dashboard/communication": ["communication:read", "route:/dashboard/communication"],
  "/dashboard/public-dgt-mail": ["communication:read", "route:/dashboard/public-dgt-mail"],
  "/dashboard/admin": ["settings:read", "super_admin", "route:/dashboard/admin"],
  "/dashboard/print-reports": ["reports:read", "route:/dashboard/print-reports"],
  "/dashboard/agent": ["shipping_records:read", "clearing_agents:read", "route:/dashboard/agent"],
  "/dashboard/expenses": ["expenses:read", "route:/dashboard/expenses"],
  "/dashboard/clearing-agent": ["clearing_agents:read", "shipping_records:read", "route:/dashboard/clearing-agent"],
  "/dashboard/shipping-line": ["shipping_records:read", "route:/dashboard/shipping-line"],
  "/dashboard/general-office/my-profile": ["dashboard:read", "profile:read", "route:/dashboard/general-office/my-profile"],
  "/dashboard/walkthrough-video": ["dashboard:read", "route:/dashboard/walkthrough-video"],
  "/dashboard/search": ["dashboard:read", "route:/dashboard/search"]
};

export const ROUTE_PERMISSION_MAP: Record<string, string[]> = {
  ...BASE_ROUTE_PERMISSION_MAP,
  ...Object.fromEntries(Object.entries(EXTRA_ROUTE_PERMISSIONS).filter(([k]) => !(k in BASE_ROUTE_PERMISSION_MAP)))
};

/** Pages every authenticated login may open (their own data / generic shells). */
export const SHARED_ROUTES: readonly string[] = [
  "/dashboard", "/dashboard/search", "/dashboard/settings/profile", "/dashboard/general-office/my-profile", "/dashboard/walkthrough-video", "/dashboard/user-tasks"
];

/** Financial / HR-money / system areas an operations or shipping-line login never opens, whatever its map entry says. */
export const FINANCIAL_ROUTE_PREFIXES: readonly string[] = [
  "/dashboard/ledger", "/dashboard/roznamcha", "/dashboard/accounts", "/dashboard/journal", "/dashboard/tax", "/dashboard/tax-einvoicing",
  "/dashboard/bill-cost-profit", "/dashboard/expenses", "/dashboard/settlement", "/dashboard/smart-due", "/dashboard/settings/bank",
  "/dashboard/general-office/payroll", "/dashboard/general-office/wps-sif", "/dashboard/general-office/gratuity",
  "/dashboard/general-office/payroll-tax", "/dashboard/general-office/payroll-reconciliation", "/dashboard/general-office/employees",
  "/dashboard/employees", "/dashboard/new-entry/users", "/dashboard/users", "/dashboard/super-admin", "/dashboard/super", "/dashboard/all-release-entries",
  "/dashboard/reports/payments", "/dashboard/reports/financial-statements", "/dashboard/reports/journal", "/dashboard/reports/exchange-rate",
  "/dashboard/crm", "/dashboard/customer-inquiries", "/dashboard/permissions", "/dashboard/system-report", "/dashboard/data", "/dashboard/audit",
  "/dashboard/audit-monitoring", "/dashboard/purchase/purchase-payments", "/dashboard/sales", "/dashboard/temp-bills", "/dashboard/ai-entry"
];

/**
 * Pages whose whole purpose is amounts / balances. A business login with the field-level financial permission DENIED
 * (finance_amounts:deny) never opens them, whatever module permission it holds. Narrower than FINANCIAL_ROUTE_PREFIXES:
 * user management, CRM etc. stay with their module permissions for such a login.
 */
export const AMOUNT_ROUTE_PREFIXES: readonly string[] = [
  "/dashboard/ledger", "/dashboard/roznamcha", "/dashboard/accounts", "/dashboard/journal", "/dashboard/tax", "/dashboard/tax-einvoicing",
  "/dashboard/bill-cost-profit", "/dashboard/expenses", "/dashboard/settlement", "/dashboard/smart-due", "/dashboard/settings/bank",
  "/dashboard/general-office/payroll", "/dashboard/general-office/wps-sif", "/dashboard/general-office/gratuity",
  "/dashboard/general-office/payroll-tax", "/dashboard/general-office/payroll-reconciliation",
  "/dashboard/reports/payments", "/dashboard/reports/financial-statements", "/dashboard/reports/journal", "/dashboard/reports/exchange-rate",
  "/dashboard/purchase/purchase-payments", "/dashboard/temp-bills", "/dashboard/super-admin", "/dashboard/all-release-entries", "/dashboard/crm"
];

export type RouteAccessInput = {
  pathname: string;
  permissions: readonly string[] | null | undefined;
  roles: readonly string[] | null | undefined;
  operationalDomains?: readonly string[] | null;
  /** session.canViewFinancials — false denies AMOUNT_ROUTE_PREFIXES even to business roles (field-level financial deny) */
  canViewFinancials?: boolean | null;
};

export type RouteDecision = {
  allowed: boolean;
  reason: "super" | "shared" | "permission" | "no_permission" | "financial_denied" | "unmapped_denied" | "unmapped_legacy_allowed" | "domain_blocked";
};

const SORTED_PREFIXES = Object.keys(ROUTE_PERMISSION_MAP).sort((a, b) => b.length - a.length);

function matchesPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(prefix + "/");
}

/** True when every role of the login is an operations / shipping-line role (strict, default-deny). */
export function isStrictLogin(roles: readonly string[] | null | undefined): boolean {
  const r = roles ?? [];
  return r.length > 0 && r.every((x) => NON_FINANCIAL_ROLES.includes(x));
}

export function evaluateRouteAccess(input: RouteAccessInput): RouteDecision {
  const path = input.pathname.split("?")[0].replace(/\/+$/, "") || "/dashboard";
  const permSet = new Set<string>([...(input.permissions ?? []), ...(input.roles ?? [])]);
  if (permSet.has("*:*") || permSet.has("super_admin")) return { allowed: true, reason: "super" };

  // a business-only login never opens the Shipping & Clearing area
  const domains = input.operationalDomains ?? null;
  if (domains && domains.length > 0 && domains.includes("business") && !domains.includes("shipping") && !domains.includes("both")) {
    const BLOCKED = ["/dashboard/shipping-clearing", "/dashboard/shipping", "/dashboard/clearing", "/dashboard/bl-entry", "/dashboard/manifest", "/dashboard/customs-clearance", "/dashboard/shipping-lines", "/dashboard/logistics"];
    if (BLOCKED.some((b) => matchesPrefix(path, b))) return { allowed: false, reason: "domain_blocked" };
  }

  const strict = isStrictLogin(input.roles);
  if (strict && FINANCIAL_ROUTE_PREFIXES.some((p) => matchesPrefix(path, p))) return { allowed: false, reason: "financial_denied" };
  if (input.canViewFinancials === false && AMOUNT_ROUTE_PREFIXES.some((p) => matchesPrefix(path, p))) return { allowed: false, reason: "financial_denied" };

  if (SHARED_ROUTES.includes(path)) return { allowed: true, reason: "shared" };

  const grants = (reqs: string[], routeKey: string) => {
    if (permSet.has("route:" + routeKey) || permSet.has("route:" + path)) return true;
    return reqs.some((p) => {
      if (permSet.has(p)) return true;
      const [resource] = p.split(":");
      return p.includes(":") && permSet.has(resource + ":*");
    });
  };

  if (ROUTE_PERMISSION_MAP[path]) {
    return grants(ROUTE_PERMISSION_MAP[path], path) ? { allowed: true, reason: "permission" } : { allowed: false, reason: "no_permission" };
  }
  const prefix = SORTED_PREFIXES.find((p) => p !== "/dashboard" && matchesPrefix(path, p));
  if (prefix) {
    return grants(ROUTE_PERMISSION_MAP[prefix], prefix) ? { allowed: true, reason: "permission" } : { allowed: false, reason: "no_permission" };
  }
  return strict ? { allowed: false, reason: "unmapped_denied" } : { allowed: true, reason: "unmapped_legacy_allowed" };
}
