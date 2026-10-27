-- 20261243_customer_order_customs_destination_assignment.sql
-- Additive non-breaking columns for Loading/Receiving Customs branch assignment, instructions, and Final Destination

alter table public.clearing_customer_orders
  add column if not exists loading_customs_required boolean default true,
  add column if not exists loading_customs_name text,
  add column if not exists loading_customs_port_border text,
  add column if not exists loading_customs_handled_by text default 'our_branch',
  add column if not exists loading_customs_branch_id uuid,
  add column if not exists loading_customs_branch_name text,
  add column if not exists loading_customs_user_id uuid,
  add column if not exists loading_customs_user_name text,
  add column if not exists loading_customs_agent_account_id uuid,
  add column if not exists loading_customs_agent_account_name text,
  add column if not exists loading_customs_instructions text,
  add column if not exists loading_customs_assigned_at timestamptz,

  add column if not exists receiving_customs_required boolean default true,
  add column if not exists receiving_customs_name text,
  add column if not exists receiving_customs_port_border text,
  add column if not exists receiving_customs_handled_by text default 'our_branch',
  add column if not exists receiving_customs_branch_id uuid,
  add column if not exists receiving_customs_branch_name text,
  add column if not exists receiving_customs_user_id uuid,
  add column if not exists receiving_customs_user_name text,
  add column if not exists receiving_customs_agent_account_id uuid,
  add column if not exists receiving_customs_agent_account_name text,
  add column if not exists receiving_customs_instructions text,
  add column if not exists receiving_customs_assigned_at timestamptz,

  add column if not exists final_destination_country_id uuid,
  add column if not exists final_destination_country_name text,
  add column if not exists final_destination_state text,
  add column if not exists final_destination_city text,
  add column if not exists final_destination_address text;
