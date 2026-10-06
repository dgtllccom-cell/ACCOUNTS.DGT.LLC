-- Patch: Purchase Orders payment recalc should also update ledger_posting_status.
-- This keeps Purchase Order reports accurate without requiring UI inference.

create or replace function recalc_purchase_order_payment_totals(p_purchase_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total numeric(18,4);
  v_adv numeric(18,4);
  v_rem numeric(18,4);
  v_cr numeric(18,4);
  v_due numeric(18,4);
  v_status purchase_order_status;
  v_posting document_status;
begin
  select coalesce(order_total,0) into v_total
  from purchase_orders
  where id = p_purchase_order_id
    and deleted_at is null;

  select
    coalesce(sum(case when kind='advance' then amount else 0 end),0),
    coalesce(sum(case when kind='remaining' then amount else 0 end),0),
    coalesce(sum(case when kind='credit' then amount else 0 end),0)
  into v_adv, v_rem, v_cr
  from purchase_order_payments
  where purchase_order_id = p_purchase_order_id
    and deleted_at is null
    and status = 'posted';

  v_due := greatest(v_total - v_adv - v_rem - v_cr, 0);

  if v_total <= 0 then
    v_status := 'pending';
  elsif v_due = 0 then
    v_status := 'completed';
  elsif (v_adv + v_rem + v_cr) > 0 then
    v_status := 'partial';
  else
    v_status := 'pending';
  end if;

  v_posting := case when (v_adv + v_rem + v_cr) > 0 then 'posted'::document_status else 'draft'::document_status end;

  update purchase_orders
  set advance_paid = v_adv,
      remaining_paid = v_rem,
      credit_amount = v_cr,
      remaining_due = v_due,
      payment_status = v_status,
      ledger_posting_status = v_posting,
      updated_at = now()
  where id = p_purchase_order_id;
end $$;

