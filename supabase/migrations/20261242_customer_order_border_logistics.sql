-- 20261242_customer_order_border_logistics.sql
-- Additive non-breaking logistics columns to persist border and location details directly on customer orders

alter table public.clearing_customer_orders
  add column if not exists exit_border_port_name text,
  add column if not exists exit_border_port_id uuid,
  add column if not exists exit_point_type text default 'border',
  add column if not exists entry_border_port_name text,
  add column if not exists entry_border_port_id uuid,
  add column if not exists entry_point_type text default 'border',
  add column if not exists loading_place text,
  add column if not exists receiving_place text;

-- Ensure erp_locations is synchronized with ports master data
insert into public.erp_locations
  (location_type, name, code, country_id, status, legacy_port_id, created_at, updated_at)
select
  case p.transport_type
    when 'sea' then 'seaport'
    when 'air' then 'airport'
    else 'land_border'
  end as loc_type,
  p.port_name,
  p.port_code,
  p.country_id,
  'active',
  p.id,
  p.created_at,
  p.updated_at
from public.ports p
where p.deleted_at is null
  and p.is_active = true
  and p.country_id is not null
  and not exists (
    select 1 from public.erp_locations el
    where el.country_id = p.country_id
      and el.location_type = case p.transport_type when 'sea' then 'seaport' when 'air' then 'airport' else 'land_border' end
      and lower(el.name) = lower(p.port_name)
  );
