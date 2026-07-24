type PermissionLevel = "super_admin" | "country" | "city" | "branch" | "department" | "user" | "agent";
export type { PermissionLevel };

export type PermissionDefinition = {
  key: string;
  label: string;
  description: string;
  group: string;
  resources: string[];
  actions: string[];
  hidden?: boolean;
};

export type PermissionTemplate = {
  key: string;
  label: string;
  description: string;
  level: PermissionLevel;
  permissions: string[];
};

export const permissionHierarchy: PermissionLevel[] = [
  "super_admin",
  "country",
  "city",
  "branch",
  "department",
  "user",
  "agent"
];

export const permissionCatalog: PermissionDefinition[] = [
  {
    key: "dashboard.access",
    label: "Dashboard",
    description: "View ERP dashboard, summaries, alerts, and operational overview.",
    group: "Dashboard",
    resources: ["dashboard", "reports"],
    actions: ["read"]
  },
  {
    key: "branch.new_entry",
    label: "New Branch Entry",
    description: "Create new branch hierarchy records.",
    group: "Branch",
    resources: ["countries", "country_branches", "city_branches", "branches"],
    actions: ["create"]
  },
  {
    key: "branch.all",
    label: "All Branches",
    description: "View all branch hierarchy records allowed by scope.",
    group: "Branch",
    resources: ["countries", "country_branches", "city_branches", "branches"],
    actions: ["read"]
  },
  {
    key: "branch.super_admin",
    label: "Super Admin Branch",
    description: "Create and maintain Super Admin branch records.",
    group: "Branch",
    resources: ["countries", "branches"],
    actions: ["create", "read", "update", "delete"]
  },
  {
    key: "branch.country",
    label: "Country Branch",
    description: "Create and maintain country/main branch records.",
    group: "Branch",
    resources: ["country_branches"],
    actions: ["create", "read", "update", "delete"]
  },
  {
    key: "branch.city",
    label: "City Branch",
    description: "Create and maintain city branch records.",
    group: "Branch",
    resources: ["city_branches"],
    actions: ["create", "read", "update", "delete"]
  },
  {
    key: "branch.general_report",
    label: "Branch General Report",
    description: "View, print, export, and inspect branch hierarchy reports.",
    group: "Branch",
    resources: ["reports", "country_branches", "city_branches"],
    actions: ["read", "export", "print"]
  },
  {
    key: "users.access",
    label: "Users",
    description: "Access user management section.",
    group: "New Entry / Users",
    resources: ["users"],
    actions: ["read"]
  },
  {
    key: "users.create",
    label: "Create User",
    description: "Create users within assigned hierarchy and permission limits.",
    group: "New Entry / Users",
    resources: ["users"],
    actions: ["create"]
  },
  {
    key: "users.edit",
    label: "Edit User",
    description: "Edit users within assigned hierarchy and permission limits.",
    group: "New Entry / Users",
    resources: ["users"],
    actions: ["update"]
  },
  {
    key: "users.delete",
    label: "Delete User",
    description: "Delete users within assigned hierarchy and permission limits.",
    group: "New Entry / Users",
    resources: ["users"],
    actions: ["delete"]
  },
  {
    key: "users.view",
    label: "View User",
    description: "View user profiles and user reports.",
    group: "New Entry / Users",
    resources: ["users"],
    actions: ["read"]
  },
  {
    key: "accounts.new_entry",
    label: "New Account Entry",
    description: "Create new Account Master records.",
    group: "Accounts",
    resources: ["accounts"],
    actions: ["create"]
  },
  {
    key: "accounts.master",
    label: "Account Master",
    description: "View and maintain Account Master records.",
    group: "Accounts",
    resources: ["accounts"],
    actions: ["create", "read", "update"]
  },
  {
    key: "accounts.reports",
    label: "Account Reports",
    description: "View and export Account Master reports.",
    group: "Accounts",
    resources: ["accounts", "reports"],
    actions: ["read", "export", "print"]
  },
  {
    key: "ledgers.general",
    label: "General Ledger",
    description: "View and work with ledgers.",
    group: "Ledgers",
    resources: ["ledgers", "ledger"],
    actions: ["create", "read", "update"]
  },
  {
    key: "ledgers.reports",
    label: "Ledger Reports",
    description: "View, print, and export ledger reports.",
    group: "Ledgers",
    resources: ["ledgers", "ledger", "reports"],
    actions: ["read", "export", "print"]
  },
  {
    key: "journal.daily_payment.purchase_payment",
    label: "Purchase Payment",
    description: "Access purchase payment posting under Journal.",
    group: "Journal / Daily Payment Entry",
    resources: ["purchases", "journal_entries", "transactions"],
    actions: ["read", "post"]
  },
  {
    key: "journal.daily_payment.add_new",
    label: "Add New Payment",
    description: "Create daily payment entries.",
    group: "Journal / Daily Payment Entry",
    resources: ["transactions", "journal_entries"],
    actions: ["create", "post"]
  },
  {
    key: "journal.daily_payment.remaining_credit",
    label: "Remaining Credit Payment",
    description: "Post remaining and credit payment records.",
    group: "Journal / Daily Payment Entry",
    resources: ["transactions", "journal_entries"],
    actions: ["create", "post", "read"]
  },
  {
    key: "journal.daily_payment.voucher",
    label: "Payment Voucher",
    description: "View, print, and export payment vouchers.",
    group: "Journal / Daily Payment Entry",
    resources: ["transactions", "reports"],
    actions: ["read", "export", "print"]
  },
  {
    key: "journal.roznamcha.general",
    label: "General Roznamcha",
    description: "View general Roznamcha records.",
    group: "Journal / Roznamcha",
    resources: ["roznamcha", "journal_entries"],
    actions: ["read"]
  },
  {
    key: "journal.roznamcha.daily_report",
    label: "Daily Entry Report",
    description: "View daily Roznamcha entry reports.",
    group: "Journal / Roznamcha",
    resources: ["roznamcha", "reports"],
    actions: ["read", "export", "print"]
  },
  {
    key: "journal.roznamcha.cash_entry",
    label: "Cash Entry Payment",
    description: "Create and post cash entry payments.",
    group: "Journal / Roznamcha",
    resources: ["roznamcha", "transactions", "journal_entries"],
    actions: ["create", "post", "read"]
  },
  {
    key: "shipping.line_master",
    label: "Shipping Line Master",
    description: "Manage shipping line master records.",
    group: "Shipping Line / Clearing Agent / Shipping Line",
    resources: ["shipping_records"],
    actions: ["create", "read", "update"]
  },
  {
    key: "shipping.processing",
    label: "Shipping Processing System",
    description: "Process shipping, shipment, and related records.",
    group: "Shipping Line / Clearing Agent / Shipping Line",
    resources: ["shipping_records", "attachments"],
    actions: ["create", "read", "update", "post", "export"]
  },
  {
    key: "clearing.agent_master",
    label: "Clearing Agent Master",
    description: "Manage clearing agent master records.",
    group: "Shipping Line / Clearing Agent / Clearing Agent",
    resources: ["clearing_agents"],
    actions: ["create", "read", "update"]
  },
  {
    key: "clearing.processing",
    label: "Clearing Agent Processing System",
    description: "Process clearing agent operational records.",
    group: "Shipping Line / Clearing Agent / Clearing Agent",
    resources: ["clearing_agents", "attachments"],
    actions: ["create", "read", "update", "post", "export"]
  },
  {
    key: "purchase.entry",
    label: "Purchase Entry",
    description: "Create purchase entries and purchase booking records.",
    group: "Purchase & Sale / Purchase",
    resources: ["purchases", "bookings"],
    actions: ["create", "read", "update"]
  },
  {
    key: "purchase.orders",
    label: "Purchase Orders",
    description: "View and manage purchase orders.",
    group: "Purchase & Sale / Purchase",
    resources: ["purchases"],
    actions: ["create", "read", "update", "post"]
  },
  {
    key: "purchase.reports",
    label: "Purchase Reports",
    description: "View and export purchase reports.",
    group: "Purchase & Sale / Purchase",
    resources: ["purchases", "reports"],
    actions: ["read", "export", "print"]
  },
  {
    key: "sales.entry",
    label: "Sales Entry",
    description: "Create sales entries and sales booking records.",
    group: "Purchase & Sale / Sales",
    resources: ["sales", "customers"],
    actions: ["create", "read", "update"]
  },
  {
    key: "sales.orders",
    label: "Sales Orders",
    description: "View and manage sales orders.",
    group: "Purchase & Sale / Sales",
    resources: ["sales"],
    actions: ["create", "read", "update", "post"]
  },
  {
    key: "sales.reports",
    label: "Sales Reports",
    description: "View and export sales reports.",
    group: "Purchase & Sale / Sales",
    resources: ["sales", "reports"],
    actions: ["read", "export", "print"]
  },
  {
    key: "reports.management.financial_summary",
    label: "Financial Summary",
    description: "View financial summary management reports.",
    group: "Reports / Management Forms",
    resources: ["reports", "global_reports"],
    actions: ["read", "export", "print"]
  },
  {
    key: "reports.management.branch_analysis",
    label: "Branch Analysis",
    description: "View branch analysis management reports.",
    group: "Reports / Management Forms",
    resources: ["reports", "country_branches", "city_branches"],
    actions: ["read", "export", "print"]
  },
  {
    key: "reports.management.dashboard",
    label: "Management Dashboard",
    description: "View management dashboard reports.",
    group: "Reports / Management Forms",
    resources: ["dashboard", "reports"],
    actions: ["read"]
  },
  {
    key: "reports.roznamcha.super_admin",
    label: "Super Admin Report",
    description: "View Super Admin Roznamcha reports.",
    group: "Reports / Roznamcha Reports",
    resources: ["roznamcha", "global_reports", "reports"],
    actions: ["read", "export", "print"]
  },
  {
    key: "reports.roznamcha.country",
    label: "Country Report",
    description: "View country scoped Roznamcha reports.",
    group: "Reports / Roznamcha Reports",
    resources: ["roznamcha", "reports"],
    actions: ["read", "export", "print"]
  },
  {
    key: "reports.roznamcha.city",
    label: "City Report",
    description: "View city scoped Roznamcha reports.",
    group: "Reports / Roznamcha Reports",
    resources: ["roznamcha", "reports"],
    actions: ["read", "export", "print"]
  },
  {
    key: "reports.roznamcha.bulk",
    label: "Bulk Report",
    description: "View bulk Roznamcha reports.",
    group: "Reports / Roznamcha Reports",
    resources: ["roznamcha", "reports"],
    actions: ["read", "export", "print"]
  },
  {
    key: "reports.ledger.general",
    label: "General Ledger Report",
    description: "View general ledger reports.",
    group: "Reports / Ledger Reports",
    resources: ["ledger", "ledgers", "reports"],
    actions: ["read", "export", "print"]
  },
  {
    key: "reports.purchase.summary",
    label: "Purchase Summary",
    description: "View purchase summary reports.",
    group: "Reports / Purchase Reports",
    resources: ["purchases", "reports"],
    actions: ["read", "export", "print"]
  },
  {
    key: "reports.purchase.supplier",
    label: "Supplier Report",
    description: "View supplier purchase reports.",
    group: "Reports / Purchase Reports",
    resources: ["purchases", "reports"],
    actions: ["read", "export", "print"]
  },
  {
    key: "reports.sales.summary",
    label: "Sales Summary",
    description: "View sales summary reports.",
    group: "Reports / Sales Reports",
    resources: ["sales", "reports"],
    actions: ["read", "export", "print"]
  },
  {
    key: "reports.sales.customer",
    label: "Customer Report",
    description: "View customer sales reports.",
    group: "Reports / Sales Reports",
    resources: ["sales", "customers", "reports"],
    actions: ["read", "export", "print"]
  },
  {
    key: "messages.inbox",
    label: "Inbox",
    description: "View message inbox.",
    group: "Message System",
    resources: ["messages"],
    actions: ["read"]
  },
  {
    key: "messages.sent",
    label: "Sent Messages",
    description: "View and send messages.",
    group: "Message System",
    resources: ["messages"],
    actions: ["create", "read"]
  },
  {
    key: "messages.notifications",
    label: "Notifications",
    description: "View ERP notifications.",
    group: "Message System",
    resources: ["messages", "notifications"],
    actions: ["read", "update"]
  },
  {
    key: "messages.email_management",
    label: "Email Management",
    description: "Configure and use country, branch, and customer email communication.",
    group: "Message System",
    resources: ["messages", "email_management"],
    actions: ["create", "read", "update"]
  },
  {
    key: "settings.company",
    label: "Company Settings",
    description: "Manage company settings.",
    group: "Settings",
    resources: ["settings", "companies"],
    actions: ["create", "read", "update"]
  },
  {
    key: "settings.user_permissions",
    label: "User Permissions",
    description: "Manage user permission assignment.",
    group: "Settings",
    resources: ["users", "roles", "settings"],
    actions: ["create", "read", "update"]
  },
  {
    key: "settings.currency",
    label: "Currency Settings",
    description: "Manage currency and exchange-rate settings.",
    group: "Settings",
    resources: ["currency_rates", "settings"],
    actions: ["create", "read", "update"]
  },
  {
    key: "settings.system",
    label: "System Settings",
    description: "Manage ERP system settings.",
    group: "Settings",
    resources: ["settings", "modules", "audit_logs"],
    actions: ["create", "read", "update"]
  },
  {
    key: "users.manage",
    label: "User Management",
    description: "Create, edit, delete, and view ERP users.",
    group: "Administration",
    resources: ["users", "roles"],
    actions: ["create", "read", "update", "delete"],
    hidden: true
  },
  {
    key: "branches.manage",
    label: "Branch Management",
    description: "Create and maintain country, city, branch, and department structure.",
    group: "Administration",
    resources: ["countries", "country_branches", "city_branches", "branches"],
    actions: ["create", "read", "update", "delete"],
    hidden: true
  },
  {
    key: "reports.view",
    label: "Reports Management",
    description: "View and export ERP reports.",
    group: "Reports",
    resources: ["reports", "global_reports"],
    actions: ["read", "export"],
    hidden: true
  },
  {
    key: "finance.access",
    label: "Financial Access",
    description: "Access financial periods, cash, approval, and posting areas.",
    group: "Finance",
    resources: ["transactions", "journal_entries", "roznamcha", "approvals", "financial_periods", "currency_rates"],
    actions: ["create", "read", "update", "post", "approve"],
    hidden: true
  },
  {
    key: "purchases.access",
    label: "Purchase Management",
    description: "Create, view, update, post, and report purchase documents.",
    group: "Operations",
    resources: ["purchases", "bookings"],
    actions: ["create", "read", "update", "post", "export"],
    hidden: true
  },
  {
    key: "sales.access",
    label: "Sales Management",
    description: "Create, view, update, post, and report sales documents.",
    group: "Operations",
    resources: ["sales", "customers"],
    actions: ["create", "read", "update", "post", "export"],
    hidden: true
  },
  {
    key: "inventory.access",
    label: "Inventory Management",
    description: "Access warehouses, goods, shipping records, and inventory reports.",
    group: "Operations",
    resources: ["products", "product_categories", "product_brands", "product_units", "warehouses", "inventory", "shipping_records", "attachments", "goods", "goods_variations"],
    actions: ["create", "read", "update", "post", "export"],
    hidden: true
  },
  {
    key: "chs_products.manage",
    label: "CHS Product Management",
    description: "Create, view, update, delete, and export CHS products.",
    group: "Operations",
    resources: ["chs_products"],
    actions: ["create", "read", "update", "delete", "export"],
    hidden: true
  },
  {
    key: "masters.access",
    label: "Masters Management",
    description: "Manage customers, companies, banks, warehouses, goods, products, and CHS product masters.",
    group: "Masters",
    resources: [
      "companies",
      "customers",
      "banks",
      "warehouses",
      "products",
      "product_categories",
      "product_brands",
      "product_units",
      "chs_products",
      "goods",
      "goods_variations"
    ],
    actions: ["create", "read", "update", "delete", "export"],
    hidden: true
  },
  {
    key: "accounts.access",
    label: "Accounts Management",
    description: "Manage accounts, ledgers, journals, and customer balances.",
    group: "Finance",
    resources: ["accounts", "ledgers", "ledger", "journal_entries", "roznamcha", "cash_entry", "payment"],
    actions: ["create", "read", "update", "post", "export"],
    hidden: true
  },
  {
    key: "settings.access",
    label: "Settings Management",
    description: "Access system settings, modules, masters, and audit logs.",
    group: "Administration",
    resources: ["settings", "modules", "audit_logs"],
    actions: ["create", "read", "update"],
    hidden: true
  },
  {
    key: "messages.access",
    label: "Messaging & Notifications",
    description: "Send and read internal, email, and notification messages.",
    group: "Communication",
    resources: ["messages"],
    actions: ["create", "read", "update"],
    hidden: true
  }
];

export const permissionTemplates: PermissionTemplate[] = [
  {
    key: "country-standard",
    label: "Country Standard",
    description: "Country can manage branches, users, accounts, ledgers, journal, purchase, sales, reports, messages, and settings within its scope.",
    level: "country",
    permissions: [
      "dashboard.access",
      "branch.new_entry",
      "branch.all",
      "branch.city",
      "branch.general_report",
      "users.access",
      "users.create",
      "users.edit",
      "users.view",
      "accounts.new_entry",
      "accounts.master",
      "accounts.reports",
      "ledgers.general",
      "ledgers.reports",
      "journal.daily_payment.purchase_payment",
      "journal.daily_payment.add_new",
      "journal.daily_payment.remaining_credit",
      "journal.daily_payment.voucher",
      "journal.roznamcha.general",
      "journal.roznamcha.daily_report",
      "journal.roznamcha.cash_entry",
      "shipping.line_master",
      "shipping.processing",
      "clearing.agent_master",
      "clearing.processing",
      "purchase.entry",
      "purchase.orders",
      "purchase.reports",
      "sales.entry",
      "sales.orders",
      "sales.reports",
      "reports.management.financial_summary",
      "reports.management.branch_analysis",
      "reports.management.dashboard",
      "reports.roznamcha.country",
      "reports.roznamcha.city",
      "reports.roznamcha.bulk",
      "reports.ledger.general",
      "reports.purchase.summary",
      "reports.purchase.supplier",
      "reports.sales.summary",
      "reports.sales.customer",
      "messages.inbox",
      "messages.sent",
      "messages.notifications",
      "messages.email_management",
      "settings.user_permissions",
      "settings.currency"
    ]
  },
  {
    key: "country-operations",
    label: "Country Operations",
    description: "Operations focused access without system settings.",
    level: "country",
    permissions: [
      "dashboard.access",
      "branch.all",
      "branch.city",
      "branch.general_report",
      "users.access",
      "users.create",
      "users.view",
      "accounts.master",
      "accounts.reports",
      "journal.roznamcha.general",
      "journal.roznamcha.daily_report",
      "journal.roznamcha.cash_entry",
      "purchase.entry",
      "purchase.orders",
      "purchase.reports",
      "sales.entry",
      "sales.orders",
      "sales.reports",
      "reports.management.branch_analysis",
      "reports.roznamcha.country",
      "reports.roznamcha.city",
      "reports.ledger.general",
      "messages.inbox",
      "messages.sent",
      "messages.notifications",
      "messages.email_management"
    ]
  },
  {
    key: "city-standard",
    label: "City Standard",
    description: "City branch can operate users, reports, purchase, sales, inventory, and accounts.",
    level: "city",
    permissions: [
      "dashboard.access",
      "users.access",
      "users.create",
      "users.edit",
      "users.view",
      "accounts.new_entry",
      "accounts.master",
      "accounts.reports",
      "ledgers.general",
      "ledgers.reports",
      "journal.daily_payment.purchase_payment",
      "journal.daily_payment.add_new",
      "journal.daily_payment.remaining_credit",
      "journal.daily_payment.voucher",
      "journal.roznamcha.general",
      "journal.roznamcha.daily_report",
      "journal.roznamcha.cash_entry",
      "purchase.entry",
      "purchase.orders",
      "purchase.reports",
      "sales.entry",
      "sales.orders",
      "sales.reports",
      "reports.roznamcha.city",
      "reports.ledger.general",
      "messages.inbox",
      "messages.sent",
      "messages.notifications",
      "messages.email_management"
    ]
  },
  {
    key: "city-limited",
    label: "City Limited",
    description: "Read/report and basic operations only.",
    level: "city",
    permissions: [
      "dashboard.access",
      "accounts.reports",
      "journal.roznamcha.daily_report",
      "purchase.reports",
      "sales.reports",
      "reports.roznamcha.city",
      "reports.ledger.general",
      "messages.inbox",
      "messages.notifications"
    ]
  },
  {
    key: "department-finance",
    label: "Department Finance",
    description: "Finance/accounting department permissions.",
    level: "department",
    permissions: [
      "dashboard.access",
      "accounts.master",
      "accounts.reports",
      "ledgers.general",
      "ledgers.reports",
      "journal.daily_payment.add_new",
      "journal.daily_payment.voucher",
      "journal.roznamcha.general",
      "journal.roznamcha.cash_entry",
      "reports.management.financial_summary",
      "reports.ledger.general"
    ]
  },
  {
    key: "user-basic",
    label: "User Basic",
    description: "Basic user operations and reports.",
    level: "user",
    permissions: ["dashboard.access", "messages.inbox", "messages.notifications"]
  },
  {
    key: "agent-basic",
    label: "Agent Basic",
    description: "Agent can operate assigned shipping, clearing, customer, and collection tasks only.",
    level: "agent",
    permissions: [
      "dashboard.access",
      "shipping.line_master",
      "shipping.processing",
      "clearing.agent_master",
      "clearing.processing",
      "purchase.reports",
      "sales.reports",
      "messages.inbox",
      "messages.sent"
    ]
  }
];

export function getPermissionTemplate(key: string) {
  return permissionTemplates.find((template) => template.key === key) ?? null;
}

export function getPermissionKeysForTemplate(key: string) {
  return getPermissionTemplate(key)?.permissions ?? [];
}

export function expandPermissionGroups(permissionKeys: string[]) {
  const selected = new Set(permissionKeys);
  return permissionCatalog
    .filter((permission) => selected.has(permission.key))
    .flatMap((permission) => permission.resources.flatMap((resource) => permission.actions.map((action) => `${resource}:${action}`)));
}

export function allPermissionGroupKeys() {
  return permissionCatalog.map((permission) => permission.key);
}

export function constrainChildPermissions(parentPermissions: string[], requestedPermissions: string[]) {
  const parent = new Set(parentPermissions);
  return requestedPermissions.filter((permission) => parent.has(permission));
}

export function groupPermissionCatalog() {
  return permissionCatalog.filter((permission) => !permission.hidden).reduce<Record<string, PermissionDefinition[]>>((groups, permission) => {
    groups[permission.group] = groups[permission.group] ?? [];
    groups[permission.group].push(permission);
    return groups;
  }, {});
}
