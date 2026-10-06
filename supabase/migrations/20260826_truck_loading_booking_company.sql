-- Person Master Phase 2 — truck_loadings.booking_company_id.
--
-- features/clearing-agent/components/truck-loading-management.tsx has a
-- "Booking Company Name" free-text field (form.bookingCompanyName) that is
-- spread into the POST payload but was never in app/api/erp/clearing-agent/
-- truck-loading/route.ts's FIELDS allowlist — silently dropped on every
-- save, never persisted at all (confirmed: truck_loadings has no matching
-- column). Adds the column and wires the field to CompanyPicker.
ALTER TABLE public.truck_loadings
  ADD COLUMN IF NOT EXISTS booking_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS truck_loadings_booking_company_idx
  ON public.truck_loadings (booking_company_id) WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
