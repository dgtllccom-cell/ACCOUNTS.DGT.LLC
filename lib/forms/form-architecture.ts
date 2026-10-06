export type EnterpriseFormMetadata = {
  formCode: string;
  moduleCode: string;
  requiredPermission: string;
  scopeFields: string[];
  translationFields: string[];
  approvalActions: string[];
  auditEntity: string;
  numberSequenceKey?: string;
};

export const standardFormSaveFlow = [
  "client_validation",
  "server_validation",
  "authentication_check",
  "permission_check",
  "scope_check",
  "approval_policy_check",
  "database_transaction",
  "translation_write",
  "audit_write",
  "report_or_ledger_integration"
] as const;

export const financialFormRequiredFields = [
  "country_id",
  "city_branch_id",
  "account_id",
  "ledger_id",
  "currency",
  "amount_or_debit_credit",
  "exchange_rate",
  "status",
  "created_by"
] as const;

export const enterpriseMultilingualLanguages = ["en", "ur", "ps", "ar", "fa"] as const;

export type EnterpriseMultilingualLanguage = (typeof enterpriseMultilingualLanguages)[number];

export type EnterpriseMultilingualRecordContract = {
  table: string;
  fields: string[];
  searchFields: string[];
  notes: string;
};

export const enterpriseMultilingualRecordContracts: EnterpriseMultilingualRecordContract[] = [
  {
    table: "customers",
    fields: ["customer_name", "company_name", "contact_person", "address", "notes"],
    searchFields: ["customer_name", "company_name", "contact_person", "mobile", "whatsapp", "email"],
    notes: "Customer and supplier-facing names, addresses, and notes must resolve through record_translations."
  },
  {
    table: "companies",
    fields: ["name", "legal_name", "address", "notes"],
    searchFields: ["name", "legal_name", "code", "registration_number", "email", "phone"],
    notes: "Company master data is reused in branches, purchases, sales, reports, and print documents."
  },
  {
    table: "goods_master",
    fields: ["goods_name", "size", "brand"],
    searchFields: ["goods_name", "product_code", "hs_code", "brand"],
    notes: "Goods names and product descriptors must be searchable in every supported language."
  },
  {
    table: "countries",
    fields: ["name"],
    searchFields: ["name", "iso2", "iso3", "currency_code"],
    notes: "Country names must resolve by logged-in language while retaining ISO and currency codes."
  },
  {
    table: "states_provinces",
    fields: ["name"],
    searchFields: ["name", "code"],
    notes: "State/province display names must be translated and filtered under their country."
  },
  {
    table: "cities",
    fields: ["name"],
    searchFields: ["name", "city_code", "postal_code"],
    notes: "City display names must be translated and searchable under the selected state/province."
  },
  {
    table: "country_branches",
    fields: ["name", "address", "owner_name"],
    searchFields: ["name", "code", "owner_name", "phone", "email"],
    notes: "Main branch names and report-visible text must use DB-level translations."
  },
  {
    table: "city_branches",
    fields: ["name", "city_name", "address", "owner_name"],
    searchFields: ["name", "code", "city_name", "owner_name", "phone", "email"],
    notes: "City branch names and report-visible text must use DB-level translations."
  },
  {
    table: "enterprise_accounts",
    fields: ["name"],
    searchFields: ["name", "code"],
    notes: "Account titles must resolve and search by language across ledgers and reports."
  },
  {
    table: "ledgers",
    fields: ["name"],
    searchFields: ["name", "code"],
    notes: "Ledger titles must resolve and search by language across statements, roznamcha, and reports."
  },
  {
    table: "purchase_orders",
    fields: ["notes", "payment_condition", "loading_type"],
    searchFields: ["purchase_order_no", "contract_no", "notes"],
    notes: "Purchase workflow text must be translated for forms, reports, PDF, and export output."
  },
  {
    table: "shipping_bl_records",
    fields: ["shipping_line_name", "vessel_name", "loading_port", "discharge_port"],
    searchFields: ["shipping_line_name", "bl_number", "container_number", "vessel_name"],
    notes: "Shipping and B/L report text must be resolved by language without changing the approved layout."
  },
  {
    table: "roznamcha_entries",
    fields: ["narration", "reference_no"],
    searchFields: ["journal_no", "voucher_no", "reference_no", "narration"],
    notes: "Financial narration must be stored language-aware while numeric posting values remain unchanged."
  }
];

export function getMultilingualContract(table: string) {
  return enterpriseMultilingualRecordContracts.find((contract) => contract.table === table) ?? null;
}

export function formRequiresApproval(metadata: EnterpriseFormMetadata, action: string) {
  return metadata.approvalActions.includes(action);
}
