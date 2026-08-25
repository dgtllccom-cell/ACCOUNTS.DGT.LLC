-- Person Master Phase 2 — Warehouse Master: close the owner/responsible-person gap.
--
-- warehouses already has warehouse_code (unique, serial-generated) and a
-- reference-quality WarehousePicker — no changes needed there. But it has
-- no owner_person_id/responsible_person_id column, even though
-- features/warehouses/warehouse-api.ts's WarehouseRecord type already
-- declares a stale, unwired `owner_customer_id` field that no route reads
-- or writes. This adds the real columns so that field can finally mean
-- something, and so the Person 360 / ERP Links screen can show which
-- warehouses a person owns or is responsible for.
ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS owner_person_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.warehouses
  ADD COLUMN IF NOT EXISTS responsible_person_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS warehouses_owner_person_idx
  ON public.warehouses (owner_person_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS warehouses_responsible_person_idx
  ON public.warehouses (responsible_person_id) WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
