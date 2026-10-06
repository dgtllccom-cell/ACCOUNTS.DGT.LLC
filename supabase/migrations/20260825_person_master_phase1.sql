-- Central Person Master Profile — Phase 1 (Foundation)
--
-- The `customers` table is repurposed as the ERP-wide Person Master: it already has
-- working NOT-NULL FKs pointing at it from `employees.person_master_id` and
-- `profiles.person_master_id`. This migration is additive-only (ADD COLUMN IF NOT EXISTS)
-- since both DEV and VPS carry real live rows — no renames, no data migration, no
-- destructive changes. Confirmed against live DEV schema (2026-08-25) before writing this:
-- customers.person_code/father_name are genuinely missing; companies.owner_person_id and
-- companies.manager_person_id don't exist at all yet (not just unused).

-- 1. customers.person_code — canonical "PER-XXXXXX" identity code (allocated on create via
--    lib/repositories/customers-repository.ts using the existing next_entity_serial() engine;
--    backfilled for existing rows separately via scripts/backfill-person-codes.mjs).
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS person_code text;

-- Partial + nullable so the backfill can proceed row-by-row without a NOT NULL constraint
-- blocking existing rows mid-migration.
CREATE UNIQUE INDEX IF NOT EXISTS customers_person_code_uidx
  ON public.customers (person_code)
  WHERE person_code IS NOT NULL AND deleted_at IS NULL;

-- 2. customers.father_name — real typed column. Previously faked by customer-form.tsx via a
--    JSON blob in `notes` and duplicated into `contact_person` for non-Business records.
--    Existing rows stay NULL; not backfilled from `contact_person` (that field is ambiguously
--    overloaded as "father name" for individuals vs "authorized contact" for businesses, so it
--    is not a reliable backfill source).
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS father_name text;

-- 3. companies.owner_person_id — links a company's Owner role back to the Person Master.
--    Confirmed missing entirely on live DEV (company-incorporation-form.tsx already sends
--    this field, but it has had nowhere to land). ON DELETE SET NULL (not RESTRICT like
--    employees) since a company shouldn't become unmodifiable if its owner record changes.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS owner_person_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS companies_owner_person_idx
  ON public.companies (owner_person_id)
  WHERE deleted_at IS NULL;

-- 4. companies.manager_person_id — Company Manager role, same pattern as owner.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS manager_person_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS companies_manager_person_idx
  ON public.companies (manager_person_id)
  WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
