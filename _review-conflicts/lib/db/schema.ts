import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const accountKind = pgEnum("account_kind", ["asset", "liability", "equity", "income", "expense"]);
export const accountStatus = pgEnum("account_status", ["active", "archived", "pending_approval"]);
export const appRole = pgEnum("app_role", [
  "super_admin",
  "country_admin",
  "main_branch_admin",
  "branch_admin",
  "city_branch_admin",
  "accountant",
  "cashier",
  "agent_user",
  "staff",
  "auditor_viewer"
]);
export const branchStatus = pgEnum("branch_status", ["active", "inactive", "closed"]);
export const branchScope = pgEnum("branch_scope", ["company", "branch"]);
export const documentStatus = pgEnum("document_status", ["draft", "posted", "cancelled"]);
export const ledgerDirection = pgEnum("ledger_direction", ["debit", "credit"]);
export const permissionAction = pgEnum("permission_action", ["create", "read", "update", "delete", "post", "approve", "export"]);
export const transactionStatus = pgEnum("transaction_status", ["draft", "posted", "cancelled"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
};

export const companies = pgTable(
  "companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    baseCurrency: text("base_currency").default("USD").notNull(),
    ownerName: text("owner_name"),
    businessType: text("business_type"),
    countryId: uuid("country_id"),
    stateProvinceId: uuid("state_province_id"),
    districtId: uuid("district_id"),
    cityId: uuid("city_id"),
    areaLocationId: uuid("area_location_id"),
    countryName: text("country_name"),
    stateName: text("state_name"),
    districtName: text("district_name"),
    cityName: text("city_name"),
    areaName: text("area_name"),
    zipCode: text("zip_code"),
    address: text("address"),
    contacts: jsonb("contacts").$type<Array<Record<string, unknown>>>().default(sql`'[]'::jsonb`).notNull(),
    registrations: jsonb("registrations").$type<Array<Record<string, unknown>>>().default(sql`'[]'::jsonb`).notNull(),
    ownerIds: jsonb("owner_ids").$type<Array<Record<string, unknown>>>().default(sql`'[]'::jsonb`).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps
  },
  (table) => ({
    nameIdx: uniqueIndex("companies_name_idx").on(table.name).where(sql`${table.deletedAt} is null`)
  })
);

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id).notNull(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps
  },
  (table) => ({
    companyCodeIdx: uniqueIndex("branches_company_code_idx")
      .on(table.companyId, table.code)
      .where(sql`${table.deletedAt} is null`)
  })
);

export const countries = pgTable(
  "countries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    iso2: text("iso2"),
    iso3: text("iso3"),
    currencyCode: text("currency_code").notNull(),
    reportingCurrency: text("reporting_currency").default("USD").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    phoneCode: text("phone_code"),
    ...timestamps
  },
  (table) => ({
    nameIdx: uniqueIndex("countries_name_idx").on(table.name).where(sql`${table.deletedAt} is null`)
  })
);

export const countryBranches = pgTable(
  "country_branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countryId: uuid("country_id").references(() => countries.id).notNull(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    localCurrency: text("local_currency").notNull(),
    isMain: boolean("is_main").default(true).notNull(),
    status: branchStatus("status").default("active").notNull(),
    createdBy: uuid("created_by").references(() => profiles.id),
    ...timestamps
  },
  (table) => ({
    countryCodeIdx: uniqueIndex("country_branches_code_idx")
      .on(table.countryId, table.code)
      .where(sql`${table.deletedAt} is null`),
    oneMainBranchIdx: uniqueIndex("country_one_main_branch_idx")
      .on(table.countryId)
      .where(sql`${table.isMain} = true and ${table.deletedAt} is null`)
  })
);

export const cityBranches = pgTable(
  "city_branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countryId: uuid("country_id").references(() => countries.id).notNull(),
    countryBranchId: uuid("country_branch_id").references(() => countryBranches.id).notNull(),
    cityName: text("city_name").notNull(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    localCurrency: text("local_currency").notNull(),
    status: branchStatus("status").default("active").notNull(),
    createdBy: uuid("created_by").references(() => profiles.id),
    ...timestamps
  },
  (table) => ({
    cityCodeIdx: uniqueIndex("city_branches_code_idx")
      .on(table.countryId, table.code)
      .where(sql`${table.deletedAt} is null`),
    cityNameIdx: uniqueIndex("city_branches_name_idx")
      .on(table.countryId, table.cityName, table.name)
      .where(sql`${table.deletedAt} is null`)
  })
);

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  fullName: text("full_name").notNull(),
  defaultCompanyId: uuid("default_company_id").references(() => companies.id),
  ...timestamps
});

export const userRoleAssignments = pgTable(
  "user_role_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => profiles.id).notNull(),
    role: appRole("role").notNull(),
    countryId: uuid("country_id"),
    countryBranchId: uuid("country_branch_id").references(() => countryBranches.id),
    cityBranchId: uuid("city_branch_id").references(() => cityBranches.id),
    isActive: boolean("is_active").default(true).notNull(),
    createdBy: uuid("created_by").references(() => profiles.id),
    ...timestamps
  },
  (table) => ({
    userRoleIdx: index("user_role_assignments_user_idx").on(table.userId, table.role),
    roleScope: check(
      "user_role_scope_chk",
      sql`(
        (${table.role} = 'super_admin' and ${table.countryId} is null and ${table.countryBranchId} is null and ${table.cityBranchId} is null)
        or (${table.role} = 'country_admin' and ${table.countryId} is not null and ${table.cityBranchId} is null)
        or (${table.role} = 'branch_admin' and ${table.countryId} is not null and ${table.cityBranchId} is not null)
        or (${table.role} = 'staff' and ${table.countryId} is not null)
      )`
    )
  })
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id).notNull(),
    name: text("name").notNull(),
    description: text("description"),
    isSystem: boolean("is_system").default(false).notNull(),
    ...timestamps
  },
  (table) => ({
    companyRoleIdx: uniqueIndex("roles_company_name_idx")
      .on(table.companyId, table.name)
      .where(sql`${table.deletedAt} is null`)
  })
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resource: text("resource").notNull(),
    action: permissionAction("action").notNull(),
    description: text("description")
  },
  (table) => ({
    resourceActionIdx: uniqueIndex("permissions_resource_action_idx").on(table.resource, table.action)
  })
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
    permissionId: uuid("permission_id").references(() => permissions.id, { onDelete: "cascade" }).notNull()
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionId] })
  })
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => profiles.id).notNull(),
    companyId: uuid("company_id").references(() => companies.id).notNull(),
    branchId: uuid("branch_id").references(() => branches.id),
    roleId: uuid("role_id").references(() => roles.id).notNull(),
    scope: branchScope("scope").default("company").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps
  },
  (table) => ({
    memberCompanyIdx: index("memberships_user_company_idx").on(table.userId, table.companyId)
  })
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id).notNull(),
    branchId: uuid("branch_id").references(() => branches.id),
    parentId: uuid("parent_id").references((): AnyPgColumn => accounts.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    kind: accountKind("kind").notNull(),
    currency: text("currency").notNull(),
    status: accountStatus("status").default("active").notNull(),
    isControlAccount: boolean("is_control_account").default(false).notNull(),
    ...timestamps
  },
  (table) => ({
    accountCodeIdx: uniqueIndex("accounts_company_code_idx")
      .on(table.companyId, table.code)
      .where(sql`${table.deletedAt} is null`)
  })
);

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id).notNull(),
    branchId: uuid("branch_id").references(() => branches.id),
    entryNo: text("entry_no").notNull(),
    entryDate: date("entry_date").notNull(),
    status: documentStatus("status").default("draft").notNull(),
    memo: text("memo"),
    sourceType: text("source_type").default("journal").notNull(),
    sourceId: uuid("source_id"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => profiles.id),
    ...timestamps
  },
  (table) => ({
    journalNoIdx: uniqueIndex("journal_entries_company_no_idx")
      .on(table.companyId, table.entryNo)
      .where(sql`${table.deletedAt} is null`)
  })
);

export const journalLines = pgTable(
  "journal_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, { onDelete: "cascade" }).notNull(),
    accountId: uuid("account_id").references(() => accounts.id).notNull(),
    description: text("description"),
    debit: numeric("debit", { precision: 18, scale: 4 }).default("0").notNull(),
    credit: numeric("credit", { precision: 18, scale: 4 }).default("0").notNull()
  },
  (table) => ({
    positiveSide: check(
      "journal_lines_one_positive_side",
      sql`(${table.debit} > 0 and ${table.credit} = 0) or (${table.credit} > 0 and ${table.debit} = 0)`
    )
  })
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id).notNull(),
    branchId: uuid("branch_id").references(() => branches.id),
    journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id).notNull(),
    journalLineId: uuid("journal_line_id").references(() => journalLines.id).notNull(),
    accountId: uuid("account_id").references(() => accounts.id).notNull(),
    entryDate: date("entry_date").notNull(),
    direction: ledgerDirection("direction").notNull(),
    amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
    currency: text("currency").notNull(),
    exchangeRate: numeric("exchange_rate", { precision: 18, scale: 8 }).default("1").notNull(),
    baseAmount: numeric("base_amount", { precision: 18, scale: 4 }).notNull(),
    ...timestamps
  },
  (table) => ({
    accountDateIdx: index("ledger_entries_account_date_idx").on(table.accountId, table.entryDate),
    amountPositive: check("ledger_entries_amount_positive", sql`${table.amount} > 0 and ${table.baseAmount} > 0`)
  })
);

export const currencyRates = pgTable(
  "currency_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countryId: uuid("country_id"),
    fromCurrency: text("from_currency").notNull(),
    toCurrency: text("to_currency").default("USD").notNull(),
    rate: numeric("rate", { precision: 18, scale: 8 }).notNull(),
    effectiveDate: date("effective_date").notNull(),
    createdBy: uuid("created_by").references(() => profiles.id),
    ...timestamps
  },
  (table) => ({
    dayIdx: uniqueIndex("currency_rates_day_idx")
      .on(table.countryId, table.fromCurrency, table.toCurrency, table.effectiveDate)
      .where(sql`${table.deletedAt} is null`),
    ratePositive: check("currency_rates_positive_chk", sql`${table.rate} > 0`),
    toUsd: check("currency_rates_to_usd_chk", sql`${table.toCurrency} = 'USD'`)
  })
);

export const dailyUsdRates = pgTable(
  "daily_usd_rates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countryId: uuid("country_id"),
    countryBranchId: uuid("country_branch_id"),
    rateDate: date("rate_date").notNull(),
    buyingRate: numeric("buying_rate", { precision: 18, scale: 8 }).notNull(),
    sellingRate: numeric("selling_rate", { precision: 18, scale: 8 }).notNull(),
    creditRate: numeric("credit_rate", { precision: 18, scale: 8 }).notNull(),
    debitRate: numeric("debit_rate", { precision: 18, scale: 8 }).notNull(),
    createdBy: uuid("created_by").references(() => profiles.id),
    ...timestamps
  }
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countryId: uuid("country_id").references(() => countries.id).notNull(),
    cityBranchId: uuid("city_branch_id").references(() => cityBranches.id),
    createdBy: uuid("created_by").references(() => profiles.id),
    transactionNo: text("transaction_no").notNull(),
    transactionDate: date("transaction_date").notNull(),
    description: text("description"),
    localCurrency: text("local_currency").notNull(),
    localAmount: numeric("local_amount", { precision: 18, scale: 4 }).notNull(),
    usdRate: numeric("usd_rate", { precision: 18, scale: 8 }).notNull(),
    usdAmount: numeric("usd_amount", { precision: 18, scale: 4 }).notNull(),
    status: transactionStatus("status").default("draft").notNull(),
    sourceTable: text("source_table"),
    sourceId: uuid("source_id"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    ...timestamps
  },
  (table) => ({
    countryNoIdx: uniqueIndex("transactions_country_no_idx")
      .on(table.countryId, table.transactionNo)
      .where(sql`${table.deletedAt} is null`),
    countryDateIdx: index("transactions_country_date_idx").on(table.countryId, table.transactionDate),
    cityDateIdx: index("transactions_city_date_idx").on(table.cityBranchId, table.transactionDate),
    amountPositive: check("transactions_amount_chk", sql`${table.localAmount} >= 0 and ${table.usdRate} > 0`)
  })
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    countryId: uuid("country_id"),
    cityBranchId: uuid("city_branch_id").references(() => cityBranches.id),
    reportType: text("report_type").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    currency: text("currency").default("USD").notNull(),
    totals: jsonb("totals").default({}).notNull(),
    generatedBy: uuid("generated_by").references(() => profiles.id),
    generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    reportCurrency: check("reports_currency_usd_chk", sql`${table.currency} = 'USD'`),
    reportPeriod: check("reports_period_chk", sql`${table.periodEnd} >= ${table.periodStart}`)
  })
);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id),
  actorId: uuid("actor_id").references(() => profiles.id),
  action: text("action").notNull(),
  entityTable: text("entity_table").notNull(),
  entityId: uuid("entity_id"),
  before: jsonb("before"),
  after: jsonb("after"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const erpDocuments = pgTable(
  "erp_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    companyId: uuid("company_id").references(() => companies.id).notNull(),
    countryId: uuid("country_id"),
    cityBranchId: uuid("city_branch_id").references(() => cityBranches.id),
    name: text("name").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => profiles.id).notNull(),
    ...timestamps
  },
  (table) => ({
    entityIdx: index("erp_documents_entity_idx").on(table.entityType, table.entityId)
  })
);

export const erpDocumentVersions = pgTable(
  "erp_document_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id").references(() => erpDocuments.id, { onDelete: "cascade" }).notNull(),
    versionNumber: integer("version_number").notNull(),
    bucket: text("bucket").notNull(),
    path: text("path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => profiles.id).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    documentVersionIdx: uniqueIndex("erp_document_versions_idx").on(table.documentId, table.versionNumber)
  })
);

export const attachments = pgTable("attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id).notNull(),
  branchId: uuid("branch_id").references(() => branches.id),
  ownerTable: text("owner_table").notNull(),
  ownerId: uuid("owner_id").notNull(),
  bucket: text("bucket").notNull(),
  path: text("path").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  uploadedBy: uuid("uploaded_by").references(() => profiles.id),
  ...timestamps
});

export const goods = pgTable(
  "goods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    chsCode: text("chs_code").notNull(),
    goodsName: text("goods_name").notNull(),
    originalLanguageCode: text("original_language_code").default("en").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    chsCodeIdx: uniqueIndex("goods_chs_code_idx")
      .on(table.chsCode)
      .where(sql`${table.deletedAt} is null`)
  })
);

export const goodsVariations = pgTable(
  "goods_variations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    goodsId: uuid("goods_id")
      .references(() => goods.id, { onDelete: "cascade" })
      .notNull(),
    originCountryId: uuid("origin_country_id").references(() => countries.id),
    size: text("size").notNull(),
    brand: text("brand").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdBy: uuid("created_by").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true })
  },
  (table) => ({
    uniqueIdx: uniqueIndex("goods_variations_unique_idx")
      .on(table.goodsId, table.originCountryId, table.size, table.brand)
      .where(sql`${table.deletedAt} is null`)
  })
);

export const savedReports = pgTable("saved_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => profiles.id).notNull(),
  name: text("name").notNull(),
  module: text("module").notNull(),
  config: jsonb("config").notNull(),
  isPublic: boolean("is_public").default(false).notNull(),
  ...timestamps
});

export const localPurchases = pgTable("local_purchases", {
  id: uuid("id").defaultRandom().primaryKey(),
  companyId: uuid("company_id").references(() => companies.id),
  countryId: uuid("country_id").references(() => countries.id),
  countryBranchId: uuid("country_branch_id").references(() => countryBranches.id),
  cityBranchId: uuid("city_branch_id").references(() => cityBranches.id),
  goodsId: uuid("goods_id").references(() => goods.id),
  purchaseAccountNo: text("purchase_account_no"),
  salesAccountNo: text("sales_account_no"),
  brokerAccountNo: text("broker_account_no"),
  brand: text("brand"),
  size: text("size"),
  chassisCode: text("chassis_code"),
  goodsName: text("goods_name").notNull(),
  supplierName: text("supplier_name"),
  paymentMode: text("payment_mode").default("Cash"),
  shippingMode: text("shipping_mode").default("Local Market"),
  originCountryId: uuid("origin_country_id").references(() => countries.id),
  originCountryName: text("origin_country_name").default("Local"),
  advancePercentage: numeric("advance_percentage", { precision: 5, scale: 2 }).default("0"),
  advanceAmount: numeric("advance_amount", { precision: 18, scale: 4 }).default("0"),
  remainingBalance: numeric("remaining_balance", { precision: 18, scale: 4 }).default("0"),
  warehouseName: text("warehouse_name"),
  warehousePlotNo: text("warehouse_plot_no"),
  transferDate: text("transfer_date"),
  truckNo: text("truck_no"),
  driverName: text("driver_name"),
  quantityName: text("quantity_name").default("Bags").notNull(),
  quantityKgs: numeric("quantity_kgs", { precision: 18, scale: 4 }).default("0").notNull(),
  totalGrossWeight: numeric("total_gross_weight", { precision: 18, scale: 4 }).default("0").notNull(),
  emptyKgs: numeric("empty_kgs", { precision: 18, scale: 4 }).default("0").notNull(),
  netWeight: numeric("net_weight", { precision: 18, scale: 4 }).default("0").notNull(),
  divideKgs: numeric("divide_kgs", { precision: 18, scale: 4 }).default("0").notNull(),
  numbers: numeric("numbers", { precision: 18, scale: 4 }).default("0").notNull(),
  rateType: text("rate_type").default("per_kg").notNull(),
  purchaseRate: numeric("purchase_rate", { precision: 18, scale: 4 }).default("0").notNull(),
  purchaseCurrency: text("purchase_currency").default("USD").notNull(),
  exchangeRate: numeric("exchange_rate", { precision: 18, scale: 8 }).default("1").notNull(),
  localCurrency: text("local_currency").default("PKR").notNull(),
  purchaseCost: numeric("purchase_cost", { precision: 18, scale: 4 }).default("0").notNull(),
  finalCost: numeric("final_cost", { precision: 18, scale: 4 }).default("0").notNull(),
  createdBy: uuid("created_by").references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true })
});



