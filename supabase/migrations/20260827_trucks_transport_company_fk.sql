-- Sub-phase B: trucks.transport_company was free text with no FK, despite CompanyPicker/companies
-- master already covering exactly this concept (a transport/logistics company that owns/operates
-- the truck, distinct from owner_person_id which is Phase 2's individual-owner FK).
ALTER TABLE public.trucks
  ADD COLUMN IF NOT EXISTS transport_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
