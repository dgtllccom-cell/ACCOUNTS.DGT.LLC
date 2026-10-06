-- ============================================================================
-- MIGRATION: 20261123_roznamcha_entry_category_add_shipping.sql
-- Widen roznamcha_entries.entry_category's CHECK constraint to allow 'shipping'
-- (existing values: business, bank, cash, invoice, transfer). Additive only —
-- widens the allowed set, never narrows it; no existing row's value changes.
-- Needed so shipping customer-charge / receipt postings (roznamchaCategory:
-- "shipping" in lib/api/erp-validation.ts's roznamchaPostingSchema) can be
-- reported/filtered as their own category, matching the operational_domain
-- convention already used elsewhere in this schema.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'roznamcha_entries_entry_category_check'
  ) THEN
    ALTER TABLE public.roznamcha_entries DROP CONSTRAINT roznamcha_entries_entry_category_check;
  END IF;

  ALTER TABLE public.roznamcha_entries
    ADD CONSTRAINT roznamcha_entries_entry_category_check
    CHECK (entry_category IS NULL OR entry_category IN ('business', 'bank', 'cash', 'invoice', 'transfer', 'shipping'));
END $$;
