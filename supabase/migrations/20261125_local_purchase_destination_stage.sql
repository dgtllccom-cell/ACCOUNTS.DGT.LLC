-- Local Purchase destination routing: after a bill is posted (Transfer & Post),
-- the destination chosen at booking time (Loading by Truck / Warehouse Transfer /
-- Export Shipment, persisted as local_purchases.shipping_mode) must determine
-- the actual next operational queue. These columns track each destination's own
-- completion state without touching the accounting posting (journal_entry_id /
-- roznamcha_entry_id), which already posts exactly once regardless of destination.
ALTER TABLE public.local_purchases
  ADD COLUMN IF NOT EXISTS warehouse_transfer_status text,
  ADD COLUMN IF NOT EXISTS warehouse_transferred_at timestamptz,
  ADD COLUMN IF NOT EXISTS warehouse_transferred_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS loading_status text,
  ADD COLUMN IF NOT EXISTS loading_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS loading_completed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS export_status text,
  ADD COLUMN IF NOT EXISTS export_handover_at timestamptz,
  ADD COLUMN IF NOT EXISTS export_handover_by uuid REFERENCES public.profiles(id);
