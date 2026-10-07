export const enterpriseRoles = [
  "super_admin",
  "super_admin_reports",
  "country_admin",
  "country_user",
  "main_branch_admin",
  "city_branch_admin",
  "accountant",
  "cashier",
  "agent_user",
  "staff_user",
  "auditor_viewer"
] as const;

/**
 * Roles stored in user_role_assignments.role (the app_role enum). They decide the SCOPE LEVEL of an assignment.
 */
export type StoredEnterpriseRole = (typeof enterpriseRoles)[number];

/**
 * Effective roles DERIVED from (stored role, access_profile) by the session builder — never stored, never offered in
 * a role dropdown. They exist so that an operations / shipping-line login is a different, narrower role than the
 * business role that shares its scope level (a Global Operations Admin is NOT a Super Admin).
 */
export const virtualRoles = [
  "business_super_admin",
  "shipping_super_admin",
  "global_operations_admin",
  "country_operations_admin",
  "city_operations_admin",
  "shipping_line_admin",
  "shipping_line_user"
] as const;
export type VirtualRole = (typeof virtualRoles)[number];

export type EnterpriseRole = StoredEnterpriseRole | VirtualRole;

/** Access profiles: what an assignment may DO inside the scope its role decides. NULL = the standard role template. */
export const accessProfiles = ["operations", "shipping_line"] as const;
export type AccessProfile = (typeof accessProfiles)[number];

export type ScopeLevel = "global" | "country" | "main_branch" | "city_branch";

/** Scope level of an assignment, from its STORED role (the single place this mapping lives). */
export function storedRoleScopeLevel(role: string): ScopeLevel {
  switch (role) {
    case "super_admin":
    case "super_admin_reports":
      return "global";
    case "country_admin":
    case "country_user":
      return "country";
    case "main_branch_admin":
      return "main_branch";
    default:
      return "city_branch";
  }
}

/**
 * (stored role, access profile) -> effective role.
 *   NULL profile                       -> the stored role itself (unchanged behaviour for every existing user)
 *   operations    @ global/country/branch -> global / country / city operations admin
 *   shipping_line @ admin level          -> shipping line admin ; @ user level (agent_user, staff) -> shipping line user
 */
export function deriveEffectiveRole(storedRole: StoredEnterpriseRole, profile: AccessProfile | null | undefined, operationalDomain?: string | null): EnterpriseRole {
  // A Super Admin assignment bound to ONE operational domain is a domain super admin: it manages that domain's branches and
  // users across the network, never the other domain and never the Global Super Admin surface. 'both' = Global Super Admin.
  if (storedRole === "super_admin" && !profile) {
    if (operationalDomain === "business") return "business_super_admin";
    if (operationalDomain === "shipping") return "shipping_super_admin";
  }
  if (!profile) return storedRole;
  const level = storedRoleScopeLevel(storedRole);
  if (profile === "operations") {
    if (level === "global") return "global_operations_admin";
    if (level === "country") return "country_operations_admin";
    return "city_operations_admin"; // main branch and city branch operations admins see their own branch tree only
  }
  const adminLevel = level !== "city_branch" || storedRole === "city_branch_admin";
  return adminLevel ? "shipping_line_admin" : "shipping_line_user";
}

/** Country-level roles: they own their whole country, including branches that were later deactivated. */
export const COUNTRY_LEVEL_ROLES: readonly string[] = ["country_admin", "country_user", "country_operations_admin"];
/** Roles whose scope is global but whose permissions are NOT "everything". */
export const GLOBAL_SCOPE_ROLES: readonly string[] = ["super_admin", "super_admin_reports", "global_operations_admin"];
/** Operational / shipping-line roles: financial modules are denied by construction. */
export const NON_FINANCIAL_ROLES: readonly string[] = [
  "global_operations_admin", "country_operations_admin", "city_operations_admin", "shipping_line_admin", "shipping_line_user",
  "shipping_super_admin"
];
/**
 * Domain super admins (stored role super_admin + operational_domain business|shipping). NOT Super Admins: no wildcard, no
 * Super Admin pages, and their data scope is every branch of THEIR domain only (see the session builder).
 */
export const DOMAIN_SUPER_ADMIN_ROLES: readonly string[] = ["business_super_admin", "shipping_super_admin"];
export function domainSuperAdminDomain(roles: readonly string[] | null | undefined): "business" | "shipping" | null {
  const r = roles ?? [];
  if (r.includes("super_admin")) return null;
  if (r.includes("business_super_admin")) return "business";
  if (r.includes("shipping_super_admin")) return "shipping";
  return null;
}
/**
 * Menu-only role aliases: sidebar entries declare the stored roles that may see them. A domain super admin sees the entries
 * of the admin roles it stands above; the route policy and the APIs still decide by its own permissions and domain.
 */
export const MENU_ROLE_ALIASES: Readonly<Record<string, readonly string[]>> = {
  business_super_admin: ["country_admin", "main_branch_admin", "city_branch_admin", "accountant"],
  shipping_super_admin: ["country_admin", "main_branch_admin", "city_branch_admin", "shipping_line_admin"]
};

export function isCountryLevelRole(role: string): boolean { return COUNTRY_LEVEL_ROLES.includes(role); }

export const enterpriseRoleScopes: Record<EnterpriseRole, string> = {
  super_admin: "Global",
  super_admin_reports: "Global Read-Only Reports",
  country_admin: "Assigned country",
  country_user: "Assigned country",
  main_branch_admin: "Assigned country main branch",
  city_branch_admin: "Assigned city branch",
  accountant: "Assigned accounting scope",
  cashier: "Assigned cash/payment scope",
  agent_user: "Assigned agent tasks",
  staff_user: "Assigned staff tasks",
  auditor_viewer: "Read-only assigned scope",
  business_super_admin: "Every Business branch of the network (no Shipping Line control)",
  shipping_super_admin: "Every Shipping Line branch of the network (no Business / Finance)",
  global_operations_admin: "Operational modules across all permitted countries (no Finance)",
  country_operations_admin: "Operational modules of the assigned country (no Finance)",
  city_operations_admin: "Operational modules of the assigned branch (no Finance)",
  shipping_line_admin: "Shipping Line modules inside the assigned scope / shipping line",
  shipping_line_user: "Assigned Shipping Line records inside the assigned branch"
};

/**
 * Resources that are FINANCIAL. They are denied by default to every operations / shipping-line role and are
 * never part of an operational template. Used by the templates below, the effective-access report and the tests.
 */
export const FINANCIAL_RESOURCES: readonly string[] = [
  "accounts", "ledgers", "ledger_full", "roznamcha", "journal_entries", "transactions", "banks", "currency_rates",
  "exchange_rates", "expenses", "bill_expenses", "payroll", "payments", "customer_receipts",
  "clearing_bill_customer_charges", "financial_periods", "uae_tax", "pk_tax", "uae_tax_filing", "pk_tax_filing",
  "uae_tax_settings", "settlement", "investments", "smart_due", "finance_amounts", "purchases", "sales", "approvals"
];

/** Operational baseline shared by the three Operations Admin roles. NO financial resource appears here. */
const OPERATIONS_PERMISSIONS: string[] = [
  "dashboard:read",
  "countries:read", "country_branches:read", "city_branches:read",
  "users:read", "customers:read", "companies:read",
  "shipping_records:create", "shipping_records:read", "shipping_records:update",
  "shipments:create", "shipments:read", "shipments:update",
  "shipping_transfers:create", "shipping_transfers:read", "shipping_transfers:approve",
  "shipping:read", "shipping_reports:read",
  "route_templates:create", "route_templates:read", "route_templates:update",
  "location_master:read",
  "clearing_agents:read", "clearing_agent_branches:read",
  "record_transfers:create", "record_transfers:read",
  "assignments:create", "assignments:read", "assignments:update",
  "tasks:create", "tasks:read", "tasks:update",
  "documents:create", "documents:read", "documents:update", "documents:export", "documents:print",
  "messages:create", "messages:read", "whatsapp:read",
  "warehouses:read", "inventory:read", "products:read",
  // Loading / Transit & Lane are operational: quantities, BLs, containers, trucks — without purchase prices or payables.
  "purchase_logistics:create", "purchase_logistics:read", "purchase_logistics:update"
];

/** Shipping Line modules only: bookings, BL, containers, vessels/voyages, ports, tracking, documents, assigned tasks. */
const SHIPPING_LINE_ADMIN_PERMISSIONS: string[] = [
  "dashboard:read",
  "shipping_records:create", "shipping_records:read", "shipping_records:update",
  "shipments:read", "shipments:update",
  "shipping_transfers:create", "shipping_transfers:read",
  "shipping:read", "shipping_reports:read",
  "route_templates:read", "location_master:read",
  "record_transfers:create", "record_transfers:read",
  "assignments:read", "assignments:update",
  "tasks:read", "tasks:update",
  "documents:create", "documents:read", "documents:update", "documents:print",
  "messages:create", "messages:read"
];

const SHIPPING_LINE_USER_PERMISSIONS: string[] = [
  "dashboard:read",
  "shipping_records:read", "shipping_records:update",
  "shipments:read", "shipments:update",
  "shipping_transfers:read",
  "shipping:read",
  "tasks:read", "tasks:update",
  "documents:create", "documents:read",
  "messages:read", "record_transfers:read"
];

/**
 * Approved Shipping Line baseline (agent_user). Single source of truth for: the role template,
 * the one-time sync of existing Shipping users' custom permission sets (migration 20261210) and
 * the domain safeguard in the session builder. Every token below is one an existing route guard
 * actually checks. Deliberately NOT included: ledger_full:read (a Shipping user may post to another
 * branch's account without seeing its ledger/balance), *:post/approve on receipts & charges.
 */
export const SHIPPING_APPROVED_BUNDLE: readonly string[] = [
  "accounts:read",
  "accounts:create",
  "roznamcha:read",
  "roznamcha:create",
  "transactions:read",
  "transactions:create",
  "roznamcha:post_cross_branch",
  "record_transfers:read",
  "record_transfers:create",
  "shipping_records:read",
  "shipping_records:create",
  "shipping_records:update",
  "shipping_reports:read",
  "reports:read",
  "shipping:read",
  "inter_branch_transfers:read",
  "inter_branch_transfers:create",
  "inter_branch_transfers:approve",
  "clearing_bill_customer_charges:read",
  "clearing_bill_customer_charges:create",
  "customer_receipts:read",
  "customer_receipts:create"
];

/** Bundle tokens that are NOT part of the pre-existing agent_user baseline; they only apply to a Shipping-domain agent. */
export const SHIPPING_BUNDLE_SHIPPING_DOMAIN_ONLY: readonly string[] = [
  "accounts:read", "accounts:create", "roznamcha:read", "roznamcha:create", "roznamcha:post_cross_branch",
  "shipping_reports:read", "reports:read", "shipping:read", "inter_branch_transfers:read", "inter_branch_transfers:create",
  "inter_branch_transfers:approve", "clearing_bill_customer_charges:read", "clearing_bill_customer_charges:create",
  "customer_receipts:read", "customer_receipts:create"
];

export const enterpriseRolePermissions: Record<EnterpriseRole, string[]> = {
  super_admin: ["*:*"],
  super_admin_reports: [
    "dashboard:read",
    "companies:read",
    "business_groups:read",
    "country_company_profiles:read",
    "countries:read",
    "country_branches:read",
    "city_branches:read",
    "customers:read",
    "accounts:read",
    "ledgers:read",
    "roznamcha:read",
    "journal_entries:read",
    "reports:read",
    "reports:export",
    "purchases:read",
    "products:read",
    "product_categories:read",
    "product_brands:read",
    "product_units:read",
    "chs_products:read",
    "banks:read",
    "warehouses:read",
    "inventory:read",
    "sales:read",
    "shipping_records:read",
    "clearing_bill_customer_charges:read",
    "customer_receipts:read",
    "shipping_transfers:read",
    "clearing_agents:read",
    "clearing_agent_branches:read",
    "financial_periods:read",
    "currency_rates:read",
    "audit_logs:read",
    "uae_tax:read",
    "pk_tax:read",
    "uae_tax_filing:read",
    "pk_tax_filing:read",
    "uae_tax_settings:read",
    "contracts:read"
  ],
  country_admin: [
    "companies:read",
    "companies:create",
    "companies:update",
    "business_groups:read",
    "country_company_profiles:read",
    "countries:read",
    "country_branches:create",
    "country_branches:read",
    "country_branches:update",
    "city_branches:create",
    "city_branches:read",
    "city_branches:update",
    "users:create",
    "users:read",
    "users:update",
    "users:delete",
    "customers:create",
    "customers:read",
    "customers:update",
    "accounts:create",
    "accounts:read",
    "accounts:update",
    "accounts:delete",
    "ledgers:create",
    "ledgers:read",
    "ledgers:update",
    "ledgers:delete",
    "ledgers:post",
    "roznamcha:create",
    "roznamcha:read",
    "roznamcha:post",
    "roznamcha:post_cross_branch",
    "cross_branch_payment:lookup",
    "cross_branch_payment:post",
    "accounts:cross_branch_lookup",
    "journal_entries:create",
    "journal_entries:read",
    "journal_entries:post",
    "reports:read",
    "reports:export",
    "purchases:create",
    "purchases:read",
    "purchases:update",
    "purchases:post",
    "products:create",
    "products:read",
    "products:update",
    "products:delete",
    "product_categories:read",
    "product_categories:create",
    "product_categories:update",
    "product_brands:read",
    "product_brands:create",
    "product_brands:update",
    "product_units:read",
    "chs_products:create",
    "chs_products:read",
    "chs_products:update",
    "chs_products:delete",
    "chs_products:export",
    "banks:create",
    "banks:read",
    "banks:update",
    "warehouses:create",
    "warehouses:read",
    "warehouses:update",
    "inventory:read",
    "sales:create",
    "sales:read",
    "sales:update",
    "sales:post",
    "shipping_records:create",
    "shipping_records:read",
    "shipping_records:update",
    "shipping_records:approve",
    "shipping_records:reject",
    "location_master:create",
    "location_master:read",
    "location_master:update",
    "location_master:approve",
    "location_master:reject",
    "route_templates:create",
    "route_templates:read",
    "route_templates:update",
    "route_templates:delete",
    "shipping_transfers:create",
    "shipping_transfers:read",
    "shipping_transfers:approve",
    "clearing_bill_customer_charges:create",
    "clearing_bill_customer_charges:read",
    "clearing_bill_customer_charges:post",
    "customer_receipts:create",
    "customer_receipts:read",
    "customer_receipts:post",
    "clearing_agents:read",
    "clearing_agent_branches:create",
    "clearing_agent_branches:read",
    "clearing_agent_branches:update",
    "assignments:create",
    "assignments:read",
    "assignments:update",
    "record_transfers:create",
    "record_transfers:read",
    "inter_branch_transfers:create",
    "inter_branch_transfers:read",
    "inter_branch_transfers:approve",
    "messages:create",
    "messages:read",
    "email_management:create",
    "email_management:read",
    "email_management:update",
    "whatsapp:read",
    "whatsapp:create",
    "whatsapp:update",
    "whatsapp:delete",
    "currency_rates:create",
    "currency_rates:read",
    "currency_rates:update",
    "approvals:create",
    "approvals:read",
    "approvals:approve",
    "financial_periods:create",
    "financial_periods:read",
    "financial_periods:update",
    "kyc:read",
    "kyc:update",
    "kyc:approve",
    "documents:read",
    "documents:create",
    "documents:update",
    "documents:delete",
    "documents:export",
    "documents:print",
    "uae_tax:read",
    "pk_tax:read",
    "uae_tax:write",
    "pk_tax:write",
    "uae_tax_filing:read",
    "pk_tax_filing:read",
    "uae_tax_filing:write",
    "pk_tax_filing:write",
    "uae_tax_settings:read",
    "uae_tax_settings:write",
    "contracts:read",
    "contracts:write"
  ],
  country_user: [
    "dashboard:read",
    "countries:read",
    "country_branches:read",
    "city_branches:read",
    "users:read",
    "customers:read",
    "companies:read",
    "companies:create",
    "accounts:create",
    "accounts:read",
    "accounts:update",
    "ledgers:create",
    "ledgers:read",
    "ledgers:update",
    "roznamcha:create",
    "roznamcha:read",
    "reports:read",
    "reports:export",
    "purchases:read",
    "products:read",
    "product_categories:read",
    "product_brands:read",
    "product_units:read",
    "chs_products:read",
    "warehouses:read",
    "inventory:read",
    "sales:read",
    "shipping_records:read",
    "messages:read",
    "email_management:read",
    "kyc:read",
    "documents:read",
    "documents:create",
    "uae_tax:read",
    "pk_tax:read",
    "contracts:read",
    "location_master:read",
    "route_templates:read"
  ],
  main_branch_admin: [
    "companies:read",
    "companies:create",
    "companies:update",
    "business_groups:read",
    "country_company_profiles:read",
    "countries:read",
    "country_branches:read",
    "city_branches:create",
    "city_branches:read",
    "users:read",
    "customers:create",
    "customers:read",
    "customers:update",
    "accounts:create",
    "accounts:read",
    "accounts:update",
    "ledgers:create",
    "ledgers:read",
    "ledgers:update",
    "financial_periods:read",
    "roznamcha:create",
    "roznamcha:read",
    "roznamcha:post",
    "roznamcha:post_cross_branch",
    "cross_branch_payment:lookup",
    "cross_branch_payment:post",
    "accounts:cross_branch_lookup",
    "purchases:create",
    "purchases:read",
    "purchases:update",
    "purchases:post",
    "products:create",
    "products:read",
    "products:update",
    "products:delete",
    "product_categories:read",
    "product_brands:read",
    "product_units:read",
    "chs_products:create",
    "chs_products:read",
    "chs_products:update",
    "chs_products:export",
    "banks:read",
    "warehouses:read",
    "inventory:read",
    "sales:create",
    "sales:read",
    "sales:update",
    "sales:post",
    "shipping_records:create",
    "shipping_records:read",
    "shipping_records:update",
    "shipping_records:approve",
    "shipping_records:reject",
    "location_master:create",
    "location_master:read",
    "location_master:update",
    "route_templates:create",
    "route_templates:read",
    "route_templates:update",
    "shipping_transfers:create",
    "shipping_transfers:read",
    "shipping_transfers:approve",
    "clearing_bill_customer_charges:create",
    "clearing_bill_customer_charges:read",
    "clearing_bill_customer_charges:post",
    "customer_receipts:create",
    "customer_receipts:read",
    "customer_receipts:post",
    "clearing_agent_branches:read",
    "assignments:create",
    "assignments:read",
    "assignments:update",
    "record_transfers:create",
    "record_transfers:read",
    "inter_branch_transfers:create",
    "inter_branch_transfers:read",
    "inter_branch_transfers:approve",
    "messages:create",
    "messages:read",
    "email_management:create",
    "email_management:read",
    "email_management:update",
    "whatsapp:read",
    "whatsapp:create",
    "whatsapp:update",
    "whatsapp:delete",
    "currency_rates:create",
    "currency_rates:read",
    "approvals:create",
    "approvals:read",
    "reports:read",
    "kyc:read",
    "documents:read",
    "documents:create",
    "documents:update",
    "documents:export",
    "documents:print",
    "uae_tax:read",
    "pk_tax:read",
    "uae_tax:write",
    "pk_tax:write",
    "uae_tax_filing:read",
    "pk_tax_filing:read",
    "contracts:read",
    "contracts:write"
  ],
  city_branch_admin: [
    "companies:read",
    "companies:create",
    "companies:update",
    "business_groups:read",
    "country_company_profiles:read",
    "city_branches:read",
    "users:read",
    "customers:create",
    "customers:read",
    "customers:update",
    "accounts:create",
    "accounts:read",
    "accounts:update",
    "ledgers:create",
    "ledgers:read",
    "ledgers:update",
    "transactions:create",
    "transactions:read",
    "roznamcha:create",
    "roznamcha:read",
    "roznamcha:post",
    "roznamcha:post_cross_branch",
    "cross_branch_payment:lookup",
    "cross_branch_payment:post",
    "accounts:cross_branch_lookup",
    "purchases:create",
    "purchases:read",
    "purchases:update",
    "purchases:post",
    "products:create",
    "products:read",
    "products:update",
    "products:delete",
    "product_categories:read",
    "product_brands:read",
    "product_units:read",
    "chs_products:create",
    "chs_products:read",
    "chs_products:update",
    "chs_products:export",
    "banks:read",
    "warehouses:read",
    "inventory:read",
    "sales:create",
    "sales:read",
    "sales:update",
    "sales:post",
    "shipping_records:create",
    "shipping_records:read",
    "shipping_records:update",
    "shipping_records:approve",
    "shipping_records:reject",
    "location_master:create",
    "location_master:read",
    "location_master:update",
    "route_templates:create",
    "route_templates:read",
    "route_templates:update",
    "shipping_transfers:create",
    "shipping_transfers:read",
    "shipping_transfers:approve",
    "clearing_bill_customer_charges:create",
    "clearing_bill_customer_charges:read",
    "clearing_bill_customer_charges:post",
    "customer_receipts:create",
    "customer_receipts:read",
    "customer_receipts:post",
    "assignments:read",
    "record_transfers:create",
    "record_transfers:read",
    "inter_branch_transfers:create",
    "inter_branch_transfers:read",
    "inter_branch_transfers:approve",
    "messages:create",
    "messages:read",
    "email_management:create",
    "email_management:read",
    "email_management:update",
    "whatsapp:read",
    "whatsapp:create",
    "whatsapp:update",
    "whatsapp:delete",
    "currency_rates:create",
    "currency_rates:read",
    "approvals:create",
    "approvals:read",
    "reports:read",
    "kyc:read",
    "documents:read",
    "documents:create",
    "documents:update",
    "documents:export",
    "documents:print",
    "uae_tax:read",
    "pk_tax:read",
    "uae_tax:write",
    "pk_tax:write",
    "contracts:read",
    "contracts:write"
  ],
  accountant: [
    "companies:read",
    "companies:create",
    "companies:update",
    "accounts:create",
    "accounts:read",
    "customers:create",
    "customers:read",
    "customers:update",
    "journal_entries:create",
    "journal_entries:read",
    "journal_entries:post",
    "ledgers:read",
    "financial_periods:read",
    "roznamcha:create",
    "roznamcha:read",
    "roznamcha:post",
    "roznamcha:post_cross_branch",
    "cross_branch_payment:lookup",
    "cross_branch_payment:post",
    "accounts:cross_branch_lookup",
    "purchases:create",
    "purchases:read",
    "purchases:update",
    "purchases:post",
    "products:create",
    "products:read",
    "products:update",
    "products:delete",
    "product_categories:read",
    "product_brands:read",
    "product_units:read",
    "chs_products:create",
    "chs_products:read",
    "chs_products:update",
    "chs_products:export",
    "banks:read",
    "warehouses:read",
    "inventory:read",
    "sales:create",
    "sales:read",
    "sales:update",
    "sales:post",
    "shipping_records:create",
    "shipping_records:read",
    "shipping_transfers:create",
    "shipping_transfers:read",
    "clearing_bill_customer_charges:create",
    "clearing_bill_customer_charges:read",
    "clearing_bill_customer_charges:post",
    "customer_receipts:create",
    "customer_receipts:read",
    "customer_receipts:post",
    "record_transfers:create",
    "record_transfers:read",
    "inter_branch_transfers:create",
    "inter_branch_transfers:read",
    // Accountant already has create+read on this resource (can send and view
    // handovers) but was missing approve, so any handover sent TO an
    // accountant could never be accepted — confirmed live during a real
    // handover E2E test (User A -> accountant User B, PATCH .../accept
    // returned 403 "Missing permission: inter_branch_transfers:approve").
    "inter_branch_transfers:approve",
    "currency_rates:create",
    "currency_rates:read",
    "currency_rates:update",
    "approvals:create",
    "approvals:read",
    "approvals:approve",
    "reports:read",
    "uae_tax:read",
    "pk_tax:read",
    "uae_tax:write",
    "pk_tax:write",
    "uae_tax_filing:read",
    "pk_tax_filing:read",
    "uae_tax_filing:write",
    "pk_tax_filing:write",
    "contracts:read",
    "contracts:write"
  ],
  cashier: [
    "companies:read",
    "country_branches:read",
    "city_branches:read",
    "customers:create",
    "customers:read",
    "customers:update",
    "accounts:read",
    "ledgers:read",
    "currency_rates:read",
    "transactions:create",
    "transactions:read",
    "roznamcha:create",
    "roznamcha:read",
    "roznamcha:post",
    "roznamcha:post_cross_branch",
    "cross_branch_payment:lookup",
    "cross_branch_payment:post",
    "accounts:cross_branch_lookup",
    "customer_receipts:create",
    "customer_receipts:read",
    "customer_receipts:post",
    // Read-only stock visibility for CRM/Sales screens — never a write action.
    "inventory:read"
  ],
  agent_user: [
    "transactions:create",
    "transactions:read",
    "customers:create",
    "customers:read",
    "customers:update",
    "companies:read",
    "shipping_records:create",
    "shipping_records:read",
    "shipping_records:update",
    "shipping_transfers:create",
    "shipping_transfers:read",
    "clearing_agent_branches:read",
    "route_templates:read",
    "documents:create",
    "documents:read",
    "assignments:create",
    "assignments:read",
    "assignments:update",
    "record_transfers:create",
    "record_transfers:read",
    "messages:create",
    "messages:read",
    "whatsapp:read",
    "whatsapp:create",
    // Read-only stock visibility for CRM/Sales screens — never a write action.
    "inventory:read",
    ...SHIPPING_APPROVED_BUNDLE
  ],
  staff_user: ["transactions:create", "transactions:read", "customers:read", "companies:read", "shipping_records:read", "whatsapp:read", "location_master:read", "route_templates:read"],
  auditor_viewer: ["reports:read", "audit_logs:read", "ledgers:read", "companies:read", "kyc:read", "documents:read", "uae_tax:read", "uae_tax_filing:read", "pk_tax:read", "pk_tax_filing:read", "contracts:read"],
  global_operations_admin: [...OPERATIONS_PERMISSIONS],
  country_operations_admin: [...OPERATIONS_PERMISSIONS],
  city_operations_admin: [...OPERATIONS_PERMISSIONS],
  shipping_line_admin: [...SHIPPING_LINE_ADMIN_PERMISSIONS],
  shipping_line_user: [...SHIPPING_LINE_USER_PERMISSIONS],
  // filled in below from the country_admin template (single source)
  business_super_admin: [],
  shipping_super_admin: [
    ...SHIPPING_LINE_ADMIN_PERMISSIONS,
    "shipments:create", "shipping_transfers:approve",
    "countries:read", "country_branches:read",
    "city_branches:create", "city_branches:read", "city_branches:update",
    "users:create", "users:read", "users:update", "users:delete",
    "assignments:create",
    "clearing_agents:read", "clearing_agent_branches:create", "clearing_agent_branches:read", "clearing_agent_branches:update",
    "route_templates:create", "route_templates:update",
    "customers:read", "companies:read", "location_master:read", "tasks:create", "documents:export", "whatsapp:read"
  ]
};

/** Resources that belong to the Shipping Line / Clearing domain (a Business Super Admin never holds them). */
export const SHIPPING_DOMAIN_RESOURCES: readonly string[] = [
  "shipping_records", "shipping_transfers", "shipments", "shipping", "shipping_reports", "bl_records", "customs_entries",
  "clearing_agents", "clearing_agent_branches", "clearing_bill_customer_charges", "customer_receipts", "clearing"
];

// Business Super Admin = the Country Admin business template across every Business branch, minus every Shipping-domain
// resource, plus branch-network and user management. No wildcard, no Super Admin pages.
enterpriseRolePermissions.business_super_admin = [...new Set([
  // main branches (country structure) stay with the Global Super Admin
  ...enterpriseRolePermissions.country_admin.filter((p) => !SHIPPING_DOMAIN_RESOURCES.includes(p.split(":")[0]) && p !== "country_branches:create" && p !== "country_branches:update"),
  "dashboard:read", "countries:read", "country_branches:read",
  "city_branches:create", "city_branches:read", "city_branches:update",
  "users:create", "users:read", "users:update", "users:delete",
  "purchase_logistics:create", "purchase_logistics:read", "purchase_logistics:update",
  "inventory:read", "tasks:create", "tasks:read", "tasks:update"
])];

export const dashboardByRole: Record<EnterpriseRole, string> = {
  super_admin: "/dashboard/super-admin",
  super_admin_reports: "/dashboard/reports",
  country_admin: "/dashboard/country",
  country_user: "/dashboard/country",
  main_branch_admin: "/dashboard/city",
  city_branch_admin: "/dashboard/city",
  accountant: "/dashboard/city",
  cashier: "/dashboard/city",
  agent_user: "/dashboard/agent",
  staff_user: "/dashboard/city",
  auditor_viewer: "/dashboard/reports",
  business_super_admin: "/dashboard/country",
  shipping_super_admin: "/dashboard/logistics",
  // The existing, already-scoped operational dashboards (shipments, routes, BL/containers, tasks) — no duplicate dashboards.
  global_operations_admin: "/dashboard/logistics",
  country_operations_admin: "/dashboard/logistics",
  city_operations_admin: "/dashboard/logistics",
  // no separate page: the logistics dashboard filters every card by the login's shipping line(s) (session.shippingLineIds)
  shipping_line_admin: "/dashboard/logistics",
  shipping_line_user: "/dashboard/logistics"
};

/**
 * The landing dashboard for a set of EFFECTIVE roles. The single implementation behind both /dashboard and the login redirect
 * (there used to be two hand-written copies). Broadest business role first; operational roles land on the existing scoped
 * operational dashboards; a login whose roles are unknown lands on the branch dashboard, which itself refuses without a branch.
 */
export function dashboardForRoles(roles: readonly string[], opts: { isSuperAdmin?: boolean; isShippingScoped?: boolean } = {}): string {
  if (opts.isSuperAdmin || roles.includes("super_admin")) return "/dashboard/super-admin";
  if (roles.includes("business_super_admin")) return dashboardByRole.business_super_admin;
  if (roles.includes("shipping_super_admin")) return dashboardByRole.shipping_super_admin;
  const order: EnterpriseRole[] = [
    "country_admin", "country_user",
    "main_branch_admin", "city_branch_admin", "accountant", "cashier",
    "global_operations_admin", "country_operations_admin", "city_operations_admin",
    "shipping_line_admin", "shipping_line_user",
    "agent_user", "staff_user",
    "super_admin_reports", "auditor_viewer"
  ];
  if (opts.isShippingScoped && !roles.some((r) => ["country_admin", "country_user", "main_branch_admin", "city_branch_admin", "accountant", "cashier"].includes(r))) {
    return "/dashboard/logistics";
  }
  for (const r of order) if (roles.includes(r)) return dashboardByRole[r];
  return "/dashboard/city";
}

/**
 * Hard cap for a login whose EVERY effective role is operational / shipping-line: no wildcard and no financial resource can
 * survive — not from a stale saved permission set, not from a branch rule grant. (A combined login such as Branch Admin +
 * Operations is not capped here; its access is computed per assignment by narrowSessionToPermission.)
 * "finance_amounts:deny" is kept: it only ever removes access.
 */
export function capPermissionsForRoles(roles: readonly string[], permissions: readonly string[]): string[] {
  if (!roles.length || !roles.every((r) => NON_FINANCIAL_ROLES.includes(r))) return [...permissions];
  let out = [...permissions];
  if (out.includes("*:*")) {
    // a wildcard on a strict login is replaced by its own templates, never kept
    out = [...new Set([...out.filter((p) => p !== "*:*"), ...roles.flatMap((r) => enterpriseRolePermissions[r as EnterpriseRole] ?? [])])];
  }
  return out.filter((p) => {
    if (p === "finance_amounts:deny") return true;
    const resource = p.split(":")[0];
    return resource !== "*" && !FINANCIAL_RESOURCES.includes(resource);
  });
}
