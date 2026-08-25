-- Sub-phase B: purchase_loading_records already had truck_id (unused by the UI) but transport
-- company and shipping line were plain text with no FK at all, despite CompanyPicker and
-- ShippingLinePicker (+ shipping_lines master, Phase 2) already existing.
ALTER TABLE public.purchase_loading_records
  ADD COLUMN IF NOT EXISTS transport_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shipping_line_id uuid REFERENCES public.shipping_lines(id) ON DELETE SET NULL;
