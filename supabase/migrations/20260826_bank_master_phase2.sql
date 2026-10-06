-- Person Master Phase 2 — Bank / Account Master hardening.
--
-- banks already gets 4-scope form-serials (super_admin/country/branch/entry)
-- via allocateFormSerials() for transactional numbering, but has no single
-- permanent global human-readable code and no owner FK at all. Adds both,
-- mirroring the companies.owner_person_id/manager_person_id precedent: an
-- account can belong to a person directly (personal account) or to one of
-- their companies (corporate account) — both FKs are nullable, at most one
-- is expected to be set by the UI, but that's a form-level convention, not
-- enforced here (a bank record with neither set is also valid: legacy rows,
-- or an account not yet linked to a Person Master owner).
ALTER TABLE public.banks ADD COLUMN IF NOT EXISTS account_code text;
ALTER TABLE public.banks
  ADD COLUMN IF NOT EXISTS owner_person_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.banks
  ADD COLUMN IF NOT EXISTS owner_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS banks_account_code_uidx
  ON public.banks (account_code)
  WHERE account_code IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS banks_owner_person_idx
  ON public.banks (owner_person_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS banks_owner_company_idx
  ON public.banks (owner_company_id) WHERE deleted_at IS NULL;

-- Roznamcha bank-payment entries currently capture the chosen bank as free
-- text only (features/roznamcha/components/cash-entry-form.tsx). Add the FK
-- so that flow can be fixed to actually reference the Bank Master.
ALTER TABLE public.roznamcha_entries
  ADD COLUMN IF NOT EXISTS bank_id uuid REFERENCES public.banks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS roznamcha_entries_bank_idx
  ON public.roznamcha_entries (bank_id);

NOTIFY pgrst, 'reload schema';
