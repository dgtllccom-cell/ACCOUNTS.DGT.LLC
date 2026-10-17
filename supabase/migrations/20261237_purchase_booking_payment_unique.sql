-- One live "booking" payment per purchase order — database-level guard for exactly-once Purchase Booking transfer.
--
-- The transfer route checks "is there already a booking payment?" and then posts through post_purchase_booking_transfer. Two requests that
-- pass that check at the same moment (double click, two tabs, a retry) could both post, doubling the Debit/Credit. This partial unique index
-- makes the second insert fail inside the posting transaction (the whole posting rolls back), so the ledger can never be double-posted.
--
-- ADDITIVE ONLY: no data is changed. Safe to create because no order has more than one live booking payment (checked on DEV and Production
-- before this migration was written). Soft-deleted payments are ignored, so a reversed booking can be transferred again.
CREATE UNIQUE INDEX IF NOT EXISTS uq_po_payments_one_live_booking
  ON public.purchase_order_payments (purchase_order_id)
  WHERE kind = 'booking' AND deleted_at IS NULL AND purchase_order_id IS NOT NULL;

COMMENT ON INDEX public.uq_po_payments_one_live_booking IS
  'At most one live booking payment per purchase order — prevents a double Roznamcha/Ledger posting on concurrent transfers.';
