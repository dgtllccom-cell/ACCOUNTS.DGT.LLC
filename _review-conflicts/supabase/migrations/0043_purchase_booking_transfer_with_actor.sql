-- Migration: Wrapper function for post_purchase_order_payment that accepts an
-- explicit actor_id so the API can call it using the service-role client without
-- needing a separate set_config round-trip (which runs in a different transaction).
--
-- The wrapper does three things inside a single transaction:
--   1. Overrides request.jwt.claims so auth.uid() returns the caller's UUID.
--   2. Delegates to post_purchase_order_payment (which calls post_roznamcha_entry,
--      assert_enterprise_scope_access, and write_erp_audit_log — all of which
--      read auth.uid()).
--   3. The is_local = true means the override only lasts for this transaction.

create or replace function post_purchase_booking_transfer(
  p_actor_id           uuid,
  p_purchase_order_id  uuid,
  p_kind               purchase_order_payment_kind,
  p_entry_date         date,
  p_amount             numeric,
  p_currency_code      text,
  p_exchange_rate      numeric,
  p_debit_ledger_id    uuid,
  p_credit_ledger_id   uuid,
  p_reference_no       text,
  p_narration          text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result uuid;
begin
  -- Inject the actor into the JWT claims so all nested SECURITY DEFINER
  -- functions (assert_enterprise_scope_access, write_erp_audit_log, etc.)
  -- see a valid auth.uid() for the duration of this transaction.
  if p_actor_id is not null then
    perform set_config(
      'request.jwt.claims',
      json_build_object('sub', p_actor_id::text, 'role', 'authenticated')::text,
      true  -- is_local = true: only for this transaction
    );
  end if;

  -- Delegate to the existing posting function
  v_result := post_purchase_order_payment(
    p_purchase_order_id,
    p_kind,
    p_entry_date,
    p_amount,
    p_currency_code,
    p_exchange_rate,
    p_debit_ledger_id,
    p_credit_ledger_id,
    p_reference_no,
    p_narration
  );

  return v_result;
end;
$$;

-- Grant to authenticated and service_role so the API client can call it
grant execute on function post_purchase_booking_transfer(
  uuid, uuid, purchase_order_payment_kind, date, numeric, text, numeric, uuid, uuid, text, text
) to authenticated, service_role;
