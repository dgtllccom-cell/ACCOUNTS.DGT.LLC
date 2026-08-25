-- Person Master Phase 2 — Driver / Truck Owner become Person Master citizens.
--
-- trucks already has its own permanent code (truck_serial) — the truck
-- itself is already a proper master. But owner_name/owner_mobile/
-- driver_name/driver_mobile/driver_cnic_passport are all free text with no
-- FK to customers.id, so the same real person gets re-typed every time
-- they're registered as an owner or driver on a different truck. Mirrors
-- companies.owner_person_id/manager_person_id exactly. The existing
-- free-text columns stay as historical/print snapshot fields — this
-- migration's own table header already documents that convention
-- ("Loading forms keep snapshot text columns to preserve historical
-- values"); the same rationale now applies to the truck master itself.
ALTER TABLE public.trucks
  ADD COLUMN IF NOT EXISTS owner_person_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.trucks
  ADD COLUMN IF NOT EXISTS driver_person_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS trucks_owner_person_idx
  ON public.trucks (owner_person_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS trucks_driver_person_idx
  ON public.trucks (driver_person_id) WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
