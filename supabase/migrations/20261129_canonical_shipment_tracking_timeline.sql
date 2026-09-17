-- =============================================================================
-- Migration: 20261129_canonical_shipment_tracking_timeline.sql
-- Canonical Shipment & Container Auto-Tracking Timeline
--
-- Adds the single canonical event store (shipment_tracking_events) for:
-- 1. 12-milestone shipment journey lifecycle:
--    Booking Confirmed -> Empty Picked Up -> Gate In -> Loaded ->
--    Vessel Departed -> Transshipment -> Vessel/Voyage Change ->
--    Arrived -> Discharged -> Gate Out -> Empty Returned -> Closed
-- 2. Complete chronological container movement, ETA changes, and vessel changes.
-- 3. Connects directly to clearing_customer_orders and clearing_customer_order_legs
--    without creating duplicate orders or duplicate shipment entities.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.shipment_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.clearing_customer_orders(id) ON DELETE CASCADE,
  leg_id uuid REFERENCES public.clearing_customer_order_legs(id) ON DELETE CASCADE,
  event_code text NOT NULL CHECK (event_code IN (
    'booking_confirmed',
    'empty_picked_up',
    'gate_in',
    'loaded',
    'vessel_departed',
    'transshipment',
    'vessel_voyage_change',
    'arrived',
    'discharged',
    'gate_out',
    'empty_returned',
    'closed'
  )),
  event_name text NOT NULL,
  location_name text,
  event_time timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'delayed')),
  provider_name text,
  vessel_name text,
  voyage_number text,
  container_number text,
  eta timestamptz,
  remarks text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_shipment_tracking_events_order ON public.shipment_tracking_events(order_id, event_time DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_events_leg ON public.shipment_tracking_events(leg_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_events_container ON public.shipment_tracking_events(container_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shipment_tracking_events_event_code ON public.shipment_tracking_events(event_code) WHERE deleted_at IS NULL;

ALTER TABLE public.shipment_tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shipment_tracking_events_read ON public.shipment_tracking_events;
CREATE POLICY shipment_tracking_events_read ON public.shipment_tracking_events FOR SELECT USING (true);

DROP POLICY IF EXISTS shipment_tracking_events_write ON public.shipment_tracking_events;
CREATE POLICY shipment_tracking_events_write ON public.shipment_tracking_events FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE public.shipment_tracking_events IS
  'Canonical 12-milestone event timeline for shipment and container tracking under clearing_customer_orders.';
