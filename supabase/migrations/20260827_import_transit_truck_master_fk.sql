-- Sub-phase B: import_truck_loadings/transit_truck_loadings had zero master-data FK usage —
-- importer/supplier/clearing agent/transit company were all plain text despite the Person,
-- Company and Clearing Agent masters (+ pickers) already existing. Additive only; existing
-- free-text columns stay as display/print snapshots.
ALTER TABLE public.import_truck_loadings
  ADD COLUMN IF NOT EXISTS importer_person_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_person_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clearing_agent_id uuid REFERENCES public.clearing_agents(id) ON DELETE SET NULL;

ALTER TABLE public.transit_truck_loadings
  ADD COLUMN IF NOT EXISTS transit_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
