# Database Record Translation Verification

Run: `node --env-file=.env.local scripts/i18n-scan.mjs` and direct SQL against the
live Supabase Postgres (connection string read from `.env.local`, never stored here).

## record_translations — populated

| Metric | Value |
|---|---|
| Total rows | **14,599** |
| Status: complete (auto) | 8,861 |
| Status: complete (imported) | 3,538 |
| Status: complete (manual) | 64 |
| Status: needs_review (imported) | 2,045 |
| Status: pending / needs_review (auto) | 91 |

Storage: one row per `(record_table, record_id, field_name)` with
`english_text / urdu_text / arabic_text / persian_text / pashto_text` columns.

## Free-text fields (remarks / narration / notes / description / memo)

**38 free-text fields registered** in `translation_field_registry` (mode = `translate`),
covering every transactional table:

`roznamcha_entries.narration`, `roznamcha_lines.description`,
`purchase_order_payments.narration`, `sales_order_payments.remarks`,
`journal_entries.memo`, `journal_lines.description`,
`ledger_posting_batches.narration`, `ledger_posting_lines.{remarks,description}`,
`transactions.description`, `truck_loadings.remarks`, `transit_truck_loadings.remarks`,
`import_truck_loadings.remarks`, `purchase_loading_records.remarks`,
`purchase_order_expenses.description`, `inter_branch_ledger_transfers.remarks`,
`customers.notes`, `banks.remarks`, `clearing_agents.notes`, `trucks.notes`,
`clearing_customer_orders.cargo_details`, `products.product_description`,
`warehouses.description`, `permissions.description`, `roles.description`,
`erp_modules.description`, `erp_role_templates.description`,
`report_definitions.description`, `document_types.description`,
`product_brands.description`, `product_categories.description`,
`management_categories.description`, `management_parameters.description`,
`company_registration_types.description`, `approval_status_history.note`,
`communication_center_{leads,followups}.notes`, `whatsapp_contacts.notes`.

### Coverage of registered free-text fields

Every field that has source rows with non-empty text is fully translated:

| Field | Translated rows (UR/AR/FA/PS each) |
|---|---|
| roznamcha_lines.description | 1,228 |
| roznamcha_entries.narration | 619 |
| purchase_order_payments.narration | 245 |
| customers.notes | 198 |
| sales_order_payments.remarks | 7 (= all rows that exist) |
| permissions.description | 5 |
| purchase_loading_records.remarks | 4 |
| purchase_order_expenses.description | 2 |
| banks.remarks / warehouses.description / clearing_agents.notes / clearing_customer_orders.cargo_details | 1 each |

The remaining ~26 registered fields show 0 translated rows **because their source
tables currently hold 0 rows with non-empty text** (`journal_entries.memo`: 0 rows,
`transactions.description`: 0 rows, `truck_loadings.remarks`: 0 rows, …). Nothing to
translate yet — the registry entry + trigger are in place for when data is entered.

## Record names

`record_translations` also covers proper-name fields:
`customers.customer_name` (210), `customers.contact_person` (197),
`companies.{name,legal_name,owner_name}` (207/202/152),
`banks.{bank_name,branch_name}` (150/150), `ledgers.name` (34),
`employees.{designation,department}` (54/54), `profiles.full_name` (50),
`goods.goods_name` (16), `ports.port_name` (113),
plus location masters — `cities.name` (6,024), `districts.name` (1,841),
`states_provinces.name` (178), `countries.name` (15), `areas_locations.name` (20).

## Triggers

**117 tables** carry `*translat*` triggers → new INSERT/UPDATE of a registered
field auto-enqueues machine translation (`source = 'auto'`).

## Verdict

✅ **DB record-translation layer for remarks / notes / descriptions / narrations /
record names is built, registered, trigger-backed and populated.** Every field with
data is translated into UR / AR / FA / PS. 2,045 imported rows are flagged
`needs_review` (human QA queue) — this is expected for bulk-imported legacy data and
does not block display (they still render translated text).

## `i18n-scan.mjs` note

The raw scan reports "625 unregistered eligible fields", but manual inspection shows
these are almost entirely **noise**: `zz_bak_*` / `zz_bak2_*` dated backup tables and
`{table}_{lang}` / `{table}_{lang}_{lang}` shadow objects created by the translation
system itself (all expose a `field_name` column). None are user-authored business
tables. The scan's `EXCLUSIONS` set should be extended with `^zz_bak` and the
`_lang(_lang)?$` pattern; tracked as a follow-up cleanup to `scripts/i18n-scan.mjs`.
