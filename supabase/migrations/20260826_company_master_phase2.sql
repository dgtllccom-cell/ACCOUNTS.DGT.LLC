-- Person Master Phase 2 — Company Master hardening.
--
-- companies already got owner_person_id/manager_person_id in Phase 1
-- (20260825_person_master_phase1.sql). This adds the missing permanent
-- human-readable identity code (COMP-000001 style), allocated the same
-- way customers.person_code is: a direct next_entity_serial() call in
-- lib/repositories/companies-repository.ts's create(), not the 4-scope
-- allocateFormSerials() wrapper (that would produce an unwanted -SA/-C
-- infix). Additive only — both DEV and VPS carry real live company rows.
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS company_code text;

CREATE UNIQUE INDEX IF NOT EXISTS companies_company_code_uidx
  ON public.companies (company_code)
  WHERE company_code IS NOT NULL AND deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
