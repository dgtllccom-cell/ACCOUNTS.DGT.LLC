-- Business rule: a cross-border road leg (from_country_id <> to_country_id, both set)
-- must use a REGISTERED truck from the Truck Master, never a temporary one-time entry.
-- Local/short transfers (same country, e.g. warehouse->port) may still use a temporary
-- truck. Enforced at the database level so it cannot be bypassed by any client,
-- matching the client-side check already added in customer-order-management-view.tsx.

alter table public.clearing_customer_order_legs
  drop constraint if exists clearing_customer_order_legs_cross_border_truck_chk;

alter table public.clearing_customer_order_legs
  add constraint clearing_customer_order_legs_cross_border_truck_chk
  check (
    not (
      transport_mode = 'by_road'
      and from_country_id is not null
      and to_country_id is not null
      and from_country_id <> to_country_id
      and truck_registration_type = 'temporary'
    )
  );
