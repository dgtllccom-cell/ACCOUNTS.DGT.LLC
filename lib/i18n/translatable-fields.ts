/**
 * PHASE 1 — Multilingual field registry.
 *
 * Single source of truth for which user-facing text columns participate in the
 * multilingual system (stored in the central `record_translations` table).
 *
 * Modes:
 *   - "translate":    descriptive text (category/product/type/unit names, titles,
 *                     descriptions, labels). The translation engine produces real
 *                     translations for dictionary terms; unknown text falls back to
 *                     the original until a real MT engine or human correction is applied.
 *   - "transliterate": proper nouns (person / company / bank / place / vessel names).
 *                     These should be rendered phonetically per script, never "translated".
 *
 * Explicitly EXCLUDED (never auto-processed), by design:
 *   - Technical fields: ids, codes, uuids, foreign keys, timestamps, numbers, amounts,
 *     rates, emails, phones, urls, tokens, statuses/enums, hashes, file paths.
 *   - Free-form financial narration: transaction / journal / ledger / roznamcha line
 *     `description`, `narration`, `remarks`, `notes` — MUST stay exactly as entered
 *     (mistranslating accounting narration is unacceptable).
 *   - Reporting VIEWS (derived, not base tables) and denormalized `*_snapshot` copies.
 *   - The legacy per-language columns on `country_company_profiles` /
 *     `warehouses` / `communication_templates` (superseded by `record_translations`).
 *
 * This registry was generated from the live Production schema and then curated.
 * It is intentionally reviewable — a native speaker / owner can adjust any entry.
 * The automatic save workflow (Phase 2) reads only this registry.
 */

export type TranslateMode = "translate" | "transliterate";

export interface TranslatableField {
  field: string;
  mode: TranslateMode;
}

export const TRANSLATABLE_FIELDS: Record<string, TranslatableField[]> = {
  // ── Chart of accounts / ledgers (names can embed party names → transliterate) ──
  account_groups: [{ field: "name", mode: "transliterate" }],
  account_types: [{ field: "name", mode: "translate" }],
  accounts: [{ field: "name", mode: "transliterate" }],
  enterprise_accounts: [{ field: "name", mode: "transliterate" }],
  ledgers: [{ field: "name", mode: "transliterate" }],
  financial_periods: [{ field: "period_name", mode: "transliterate" }],

  // ── Locations (place names → transliterate) ──
  countries: [{ field: "name", mode: "transliterate" }],
  states_provinces: [{ field: "name", mode: "transliterate" }],
  districts: [{ field: "name", mode: "transliterate" }],
  cities: [{ field: "name", mode: "transliterate" }],
  areas_locations: [{ field: "name", mode: "transliterate" }],
  postal_codes: [
    { field: "place_name", mode: "transliterate" },
    { field: "admin1_name", mode: "transliterate" },
    { field: "admin2_name", mode: "transliterate" },
    { field: "admin3_name", mode: "transliterate" },
  ],
  loading_ports: [{ field: "port_name", mode: "transliterate" }],
  received_ports: [{ field: "port_name", mode: "transliterate" }],
  ports: [{ field: "port_name", mode: "transliterate" }],

  // ── Organizations / parties ──
  parent_business_groups: [
    { field: "name", mode: "transliterate" },
    { field: "legal_name", mode: "transliterate" },
  ],
  companies: [
    { field: "name", mode: "transliterate" },
    { field: "legal_name", mode: "transliterate" },
    { field: "owner_name", mode: "transliterate" },
    { field: "city_name", mode: "transliterate" },
    { field: "state_name", mode: "transliterate" },
    { field: "district_name", mode: "transliterate" },
    { field: "area_name", mode: "transliterate" },
    { field: "country_name", mode: "transliterate" },
  ],
  country_company_profiles: [
    { field: "company_name", mode: "transliterate" },
    { field: "legal_name", mode: "transliterate" },
    { field: "hr_manager_name", mode: "transliterate" },
    { field: "hr_department_name", mode: "translate" },
  ],
  customers: [
    { field: "customer_name", mode: "transliterate" },
    { field: "company_name", mode: "transliterate" },
    { field: "contact_person", mode: "transliterate" },
  ],
  branches: [
    { field: "name", mode: "transliterate" },
    { field: "owner_name", mode: "transliterate" },
  ],
  country_branches: [
    { field: "name", mode: "transliterate" },
    { field: "owner_name", mode: "transliterate" },
    { field: "branding_company_name", mode: "translate" },
    { field: "branding_address", mode: "translate" },
    { field: "branding_report_header", mode: "translate" },
    { field: "branding_report_footer", mode: "translate" },
  ],
  city_branches: [
    { field: "name", mode: "transliterate" },
    { field: "city_name", mode: "transliterate" },
    { field: "owner_name", mode: "transliterate" },
    { field: "branding_company_name", mode: "translate" },
    { field: "branding_address", mode: "translate" },
    { field: "branding_report_header", mode: "translate" },
    { field: "branding_report_footer", mode: "translate" },
  ],
  clearing_agents: [{ field: "name", mode: "transliterate" }],
  clearing_agent_branches: [{ field: "name", mode: "transliterate" }],
  banks: [
    { field: "bank_name", mode: "transliterate" },
    { field: "branch_name", mode: "transliterate" },
    { field: "short_name", mode: "transliterate" },
    { field: "account_title", mode: "translate" },
  ],
  profiles: [{ field: "full_name", mode: "transliterate" }],

  // ── Product / inventory master (descriptive → translate) ──
  products: [
    { field: "product_name", mode: "translate" },
    { field: "product_description", mode: "translate" },
  ],
  product_categories: [
    { field: "category_name", mode: "translate" },
    { field: "description", mode: "translate" },
  ],
  product_brands: [
    { field: "brand_name", mode: "translate" },
    { field: "description", mode: "translate" },
  ],
  product_units: [{ field: "unit_name", mode: "translate" }],
  goods: [{ field: "goods_name", mode: "translate" }],
  goods_variations: [{ field: "brand", mode: "translate" }],
  warehouses: [
    { field: "warehouse_name", mode: "transliterate" },
    { field: "owner_name", mode: "transliterate" },
    { field: "description", mode: "translate" },
  ],

  // ── Settings / master types (descriptive → translate) ──
  contact_types: [{ field: "name", mode: "translate" }],
  payment_methods: [{ field: "name", mode: "translate" }],
  tax_codes: [
    { field: "tax_name", mode: "translate" },
    { field: "country_name", mode: "transliterate" },
  ],
  roles: [
    { field: "name", mode: "translate" },
    { field: "description", mode: "translate" },
  ],
  erp_role_templates: [
    { field: "name", mode: "translate" },
    { field: "description", mode: "translate" },
  ],
  permissions: [{ field: "description", mode: "translate" }],
  erp_modules: [
    { field: "name", mode: "translate" },
    { field: "description", mode: "translate" },
  ],
  management_categories: [
    { field: "name", mode: "translate" },
    { field: "description", mode: "translate" },
  ],
  management_parameters: [
    { field: "name", mode: "translate" },
    { field: "description", mode: "translate" },
  ],
  report_definitions: [
    { field: "name", mode: "translate" },
    { field: "description", mode: "translate" },
  ],
  erp_report_templates: [{ field: "report_title", mode: "translate" }],

  // ── Logistics / shipping (party & vessel names → transliterate; goods → translate) ──
  shipping_line_records: [
    { field: "shipping_line_name", mode: "transliterate" },
    { field: "vessel_name", mode: "transliterate" },
  ],
  shipping_bl_records: [
    { field: "shipping_line_name", mode: "transliterate" },
    { field: "vessel_name", mode: "transliterate" },
  ],
  shipment_documents: [{ field: "document_type", mode: "translate" }],
  purchase_loading_records: [{ field: "carrier_name", mode: "transliterate" }],
  purchase_order_items: [
    { field: "goods_name", mode: "translate" },
    { field: "brand", mode: "translate" },
    { field: "unit_name", mode: "translate" },
  ],
  local_purchases: [
    { field: "goods_name", mode: "translate" },
    { field: "brand", mode: "translate" },
    { field: "supplier_name", mode: "transliterate" },
    { field: "driver_name", mode: "transliterate" },
    { field: "warehouse_name", mode: "transliterate" },
    { field: "origin_country_name", mode: "transliterate" },
  ],
  import_truck_loadings: [
    { field: "goods_name", mode: "translate" },
    { field: "supplier_name", mode: "transliterate" },
    { field: "importer_name", mode: "transliterate" },
    { field: "driver_name", mode: "transliterate" },
  ],
  transit_truck_loadings: [
    { field: "goods_name", mode: "translate" },
    { field: "driver_name", mode: "transliterate" },
  ],
  truck_loadings: [
    { field: "goods_name", mode: "translate" },
    { field: "driver_name", mode: "transliterate" },
    { field: "truck_name", mode: "transliterate" },
    { field: "truck_owner_name", mode: "transliterate" },
  ],
  trucks: [
    { field: "driver_name", mode: "transliterate" },
    { field: "owner_name", mode: "transliterate" },
  ],

  // ── Money exchange / expenses (party/place → transliterate; titles → translate) ──
  money_exchange_entries: [
    { field: "receipt_name", mode: "transliterate" },
    { field: "received_office_name", mode: "transliterate" },
    { field: "purchase_city", mode: "transliterate" },
    { field: "received_city", mode: "transliterate" },
  ],
  expenses_bills: [{ field: "bill_title", mode: "translate" }],
  sales_orders: [{ field: "customer_name", mode: "transliterate" }],

  // ── Documents / communication (titles/bodies → translate; names → transliterate) ──
  office_documents: [
    { field: "title", mode: "translate" },
    { field: "category", mode: "translate" },
    { field: "country_name", mode: "transliterate" },
    { field: "main_branch_name", mode: "transliterate" },
    { field: "city_branch_name", mode: "transliterate" },
  ],
  communication_templates: [
    { field: "title", mode: "translate" },
    { field: "category", mode: "translate" },
  ],
  communication_center_campaigns: [
    { field: "name", mode: "transliterate" },
    { field: "segment_name", mode: "transliterate" },
    { field: "body", mode: "translate" },
  ],
  communication_center_followups: [{ field: "title", mode: "translate" }],
  communication_center_leads: [
    { field: "lead_name", mode: "transliterate" },
    { field: "company_name", mode: "transliterate" },
    { field: "contact_person", mode: "transliterate" },
  ],
  communication_center_profiles: [
    { field: "office_name", mode: "transliterate" },
    { field: "branch_display_name", mode: "translate" },
  ],
  communication_reminder_rules: [{ field: "rule_name", mode: "transliterate" }],
  erp_email_accounts: [{ field: "display_name", mode: "translate" }],
  erp_email_providers: [{ field: "provider_name", mode: "transliterate" }],
  erp_pdf_email_jobs: [{ field: "document_title", mode: "translate" }],
  erp_assignments: [
    { field: "title", mode: "translate" },
    { field: "message", mode: "translate" },
  ],
  whatsapp_accounts: [{ field: "display_name", mode: "translate" }],
  whatsapp_contacts: [
    { field: "display_name", mode: "translate" },
    { field: "notes", mode: "translate" },
  ],
  whatsapp_messages: [{ field: "template_name", mode: "translate" }],

  // ── Transaction & operational descriptive text (narration / description / notes /
  //    remarks / memo). Enrolled as original-fallback (status "pending") — never
  //    machine-mangled; a human/engine translates later. Runtime source of truth is the
  //    DB table `translation_field_registry` (migrations 20260808 + 20260809). ──
  roznamcha_entries: [{ field: "narration", mode: "translate" }],
  roznamcha_lines: [{ field: "description", mode: "translate" }],
  journal_entries: [{ field: "memo", mode: "translate" }],
  journal_lines: [{ field: "description", mode: "translate" }],
  ledger_posting_batches: [{ field: "narration", mode: "translate" }],
  ledger_posting_lines: [
    { field: "description", mode: "translate" },
    { field: "remarks", mode: "translate" },
  ],
  transactions: [{ field: "description", mode: "translate" }],
  inter_branch_ledger_transfers: [{ field: "remarks", mode: "translate" }],
  purchase_order_expenses: [{ field: "description", mode: "translate" }],
  purchase_order_payments: [{ field: "narration", mode: "translate" }],
  sales_order_payments: [{ field: "remarks", mode: "translate" }],
  approval_status_history: [{ field: "note", mode: "translate" }],
};

/** Fields for a given table, or an empty array if the table has none registered. */
export function getTranslatableFields(table: string): TranslatableField[] {
  return TRANSLATABLE_FIELDS[table] ?? [];
}

/** All registered table names. */
export function translatableTables(): string[] {
  return Object.keys(TRANSLATABLE_FIELDS);
}
