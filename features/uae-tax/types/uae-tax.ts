/**
 * UAE Tax / VAT / e-Invoicing — shared types.
 * Row types mirror the `uae_*` tables (see
 * supabase/migrations/20260901_uae_tax_einvoicing_foundation.sql).
 */

export type UaeFilingFrequency = "monthly" | "quarterly";

export type UaeTaxLineDirection = "input" | "output";

export type UaeTransactionCategory =
  | "daily_expense"
  | "local_purchase"
  | "local_sale"
  | "booking_purchase"
  | "booking_sale"
  | "import"
  | "export"
  | "re_export"
  | "free_zone"
  | "designated_zone"
  | "own_goods_transfer"
  | "stock_transfer"
  | "other";

export type UaeTaxCategory =
  | "standard"
  | "zero_rated"
  | "exempt"
  | "reverse_charge"
  | "out_of_scope"
  | "deemed_supply";

export type UaeRecoverability =
  | "recoverable"
  | "partial"
  | "non_recoverable"
  | "pending_review";

export type UaeDocumentStatus =
  | "complete"
  | "missing"
  | "pending"
  | "invalid"
  | "review_required"
  | "ready";

export type UaeTaxLineReviewStatus = "auto" | "confirmed" | "needs_review" | "excluded";

export type UaeTaxPeriodStatus = "open" | "closing" | "filed" | "amended";

export type UaeTaxSourceModule =
  | "expenses_bill"
  | "local_purchase"
  | "local_sale"
  | "purchase_order"
  | "sales_order"
  | "import"
  | "export"
  | "re_export"
  | "credit_note"
  | "own_goods_transfer"
  | "stock_transfer"
  | "other";

export type UaeTaxLedgerRole =
  | "input_recoverable"
  | "input_non_recoverable"
  | "output_payable"
  | "reverse_charge"
  | "refund_receivable";

export type UaeTaxRuleType =
  | "rate"
  | "category"
  | "recoverability"
  | "designated_zone"
  | "place_of_supply"
  | "einvoice_validation"
  | "return_box_map"
  | "retention";

export interface UaeTaxEntity {
  id: string;
  country_id: string;
  company_id: string | null;
  trn: string;
  legal_name: string;
  registered_name: string | null;
  registration_date: string | null;
  filing_frequency: UaeFilingFrequency;
  first_period_start: string | null;
  base_currency: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
  /** joined */
  country_name?: string;
  branch_count?: number;
}

export interface UaeTaxEntityBranch {
  id: string;
  tax_entity_id: string;
  country_branch_id: string | null;
  city_branch_id: string | null;
  created_at: string;
  /** joined */
  country_branch_name?: string;
  city_branch_name?: string;
}

export interface UaeTaxRule {
  id: string;
  rule_type: UaeTaxRuleType;
  rule_key: string;
  config: Record<string, unknown>;
  version: number;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  source_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UaeDesignatedZone {
  id: string;
  zone_name: string;
  emirate: string | null;
  zone_type: "free_zone" | "designated_zone" | "mainland_special";
  is_designated: boolean;
  effective_from: string;
  effective_to: string | null;
  status: "active" | "inactive" | "superseded";
  source_reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UaeTaxPeriod {
  id: string;
  tax_entity_id: string;
  period_code: string;
  period_start: string;
  period_end: string;
  status: UaeTaxPeriodStatus;
  filed_return_id: string | null;
  filed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UaeTaxLedger {
  id: string;
  tax_entity_id: string;
  ledger_id: string;
  role: UaeTaxLedgerRole;
  created_at: string;
  /** joined */
  ledger_name?: string;
  ledger_code?: string;
}

export interface UaeTaxLine {
  id: string;
  tax_entity_id: string;
  country_id: string | null;
  country_branch_id: string | null;
  city_branch_id: string | null;
  entered_by: string | null;

  source_module: UaeTaxSourceModule;
  source_table: string;
  source_id: string;
  source_line_id: string | null;
  source_reference_no: string | null;
  source_date: string;

  direction: UaeTaxLineDirection;
  transaction_category: UaeTransactionCategory;
  tax_category: UaeTaxCategory;

  party_name: string | null;
  party_trn: string | null;
  account_name: string | null;
  description: string | null;

  line_amount: number;
  tax_code_id: string | null;
  vat_rate: number;
  taxable_amount: number;
  vat_amount: number;

  recoverability: UaeRecoverability;
  recoverable_amount: number;

  currency: string;
  exchange_rate: number;
  aed_taxable_amount: number;
  aed_vat_amount: number;

  roznamcha_entry_id: string | null;
  journal_reference: string | null;
  ledger_reference: string | null;

  tax_period_id: string | null;
  vat_return_box: string | null;
  vat_return_id: string | null;

  document_status: UaeDocumentStatus;
  evidence_document_id: string | null;

  review_status: UaeTaxLineReviewStatus;
  synced_at: string;
  created_at: string;
  updated_at: string;

  /** joined (uae_tax_lines_v) */
  tax_entity_trn?: string;
  tax_entity_name?: string;
  country_name?: string;
  country_branch_name?: string;
  city_branch_name?: string;
  tax_period_code?: string;
  tax_code_name?: string;
  entered_by_name?: string;
}

export interface UaeTaxDashboardKpis {
  output_taxable_aed: number;
  output_vat_aed: number;
  output_zero_rated_aed: number;
  output_exempt_aed: number;
  input_taxable_aed: number;
  input_vat_aed: number;
  input_recoverable_aed: number;
  input_non_recoverable_aed: number;
  expense_vat_aed: number;
  import_vat_aed: number;
  export_aed: number;
  re_export_aed: number;
  net_vat_aed: number;
  lines_total: number;
  lines_missing_document: number;
  lines_needs_review: number;
  lines_pending_recovery: number;
}

export interface UaeTaxLineListResult {
  items: UaeTaxLine[];
  total: number;
}

/** Filters accepted by GET /api/erp/uae-tax and the service list method. */
export interface UaeTaxLineFilters {
  taxEntityId?: string | null;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  periodId?: string | null;
  direction?: UaeTaxLineDirection | "all";
  transactionCategory?: UaeTransactionCategory | "all";
  taxCategory?: UaeTaxCategory | "all";
  recoverability?: UaeRecoverability | "all";
  documentStatus?: UaeDocumentStatus | "all";
  party?: string | null;
  currency?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
}

/** The 21 UAE sub-page slugs under /dashboard/tax-einvoicing/uae/<slug>. */
export const UAE_TAX_PAGE_SLUGS = [
  "dashboard",
  "vat-control",
  "purchase-input-vat",
  "sales-output-vat",
  "daily-expenses-vat",
  "local-purchase-tax",
  "local-sales-tax",
  "booking-purchase-tax",
  "booking-sales-tax",
  "import-vat",
  "export-reexport",
  "free-zone",
  "vat-recovery",
  "e-invoices",
  "credit-notes",
  "vat-return",
  "tax-documentation",
  "asp-fta-status",
  "tax-reports",
  "audit-logs",
  "settings",
] as const;

export type UaeTaxPageSlug = (typeof UAE_TAX_PAGE_SLUGS)[number];
