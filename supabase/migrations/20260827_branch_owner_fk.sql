-- Sub-phase B: Branch Owner FK hardening.
-- BranchOwnerPicker (features/branches/components/branch-owner-picker.tsx) looked like a real
-- master-data picker but stored a plain display-name string (row.customer_name / row.fullName)
-- into <table>.owner_name — never a real FK. Owners can be either a Person Master customer or an
-- internal system user (profile), so this adds two mutually-exclusive nullable FK columns
-- (mirroring the clearing_agents.person_id/company_id precedent) rather than a single FK, since a
-- single column can't safely reference two different tables.
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS owner_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.country_branches
  ADD COLUMN IF NOT EXISTS owner_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.city_branches
  ADD COLUMN IF NOT EXISTS owner_customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS owner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
