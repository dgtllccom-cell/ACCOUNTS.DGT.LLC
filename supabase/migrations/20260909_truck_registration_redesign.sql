-- Truck Registration redesign: reuse the existing Person/Company masters instead of the
-- per-language name-snapshot columns the previous wizard wrote (owner_name_en/ur/ar/fa/ps,
-- driver_name_*, transport_company_*) — those are left in place (harmless legacy data) but the
-- redesigned form no longer writes to them; display names are resolved live from the FK'd
-- customers/companies records via the ERP's one central translation architecture.
--
-- transport_company_id (added in an earlier Sub-phase B migration) is reused as-is for the
-- mandatory "Registered Company" field. Transporter is a new person-based role (reuses the
-- Customer/Person master, same as Owner and Driver), and truck_name is a genuinely new
-- attribute the approved design requires that had no existing column.
ALTER TABLE public.trucks
  ADD COLUMN IF NOT EXISTS transporter_person_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS truck_name text;
