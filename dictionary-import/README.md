# Business Dictionary Import — drop the 5 supplied files here

Place these files in THIS folder, then run the importer:

- ERP_dictionary_import.csv          (business terms: en, ur, ps, fa, ar)
- ERP_transaction_templates_import.csv (transaction sentences/templates)
- ERP_proper_names_review.csv        (Company/Customer/Bank/City/Port/Branch names)
- record_translations_integration.sql (optional ready-made SQL)
- ERP_5_Language_Business_Dictionary.xlsx (reference only; CSVs are imported)

## Run
    node scripts/import-business-dictionary.mjs --dry-run   # parse + report, NO writes
    node scripts/import-business-dictionary.mjs             # import into LOCAL dev DB
    node scripts/import-business-dictionary.mjs --vps       # import into VPS/production DB

## Behavior (matches the approved-translation policy)
- ERP_dictionary_import.csv          -> record_translations, record_table='system_dictionary', status='complete'
- ERP_transaction_templates_import.csv -> record_table='transaction_templates', status='complete'
- ERP_proper_names_review.csv        -> status='needs_review' unless the file supplies an approved value
  (proper names are NEVER auto-invented/transliterated)
- Idempotent: keyed by (record_table, record_id, field_name); record_id = deterministic UUIDv5(term),
  so re-running updates instead of duplicating.

## Column names
The importer auto-detects common header variants: en/english, ur/urdu, ps/pashto,
fa/persian/farsi, ar/arabic, status, table/module/category. If your CSV uses different
headers, tell me and I'll map them.
