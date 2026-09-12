-- Migration: Add first-class reference and shipping claim columns to inter_country_transfers
-- Date: 2026-09-12

ALTER TABLE public.inter_country_transfers
  ADD COLUMN IF NOT EXISTS bill_number text,
  ADD COLUMN IF NOT EXISTS container_number text,
  ADD COLUMN IF NOT EXISTS order_reference text,
  ADD COLUMN IF NOT EXISTS bl_number text,
  ADD COLUMN IF NOT EXISTS job_number text,
  ADD COLUMN IF NOT EXISTS customer_party_name text,
  ADD COLUMN IF NOT EXISTS reference_date date,
  ADD COLUMN IF NOT EXISTS claim_category text DEFAULT 'general_business',
  ADD COLUMN IF NOT EXISTS claim_description text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.inter_country_transfers.claim_category IS 'Category of transfer/claim: general_business, shipping_line, or trade';
COMMENT ON COLUMN public.inter_country_transfers.bill_number IS 'Associated invoice/bill reference';
COMMENT ON COLUMN public.inter_country_transfers.container_number IS 'Container number for shipping or cargo claims';
COMMENT ON COLUMN public.inter_country_transfers.bl_number IS 'Bill of Lading reference for maritime shipping line transfers';
COMMENT ON COLUMN public.inter_country_transfers.job_number IS 'Clearing or freight forwarder job reference';
COMMENT ON COLUMN public.inter_country_transfers.customer_party_name IS 'Customer, merchant, or consignee party name';
