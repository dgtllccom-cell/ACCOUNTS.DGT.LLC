-- Migration: Add shipping_line_id and linked_countries to enterprise_accounts and shipping_lines
alter table enterprise_accounts
  add column if not exists shipping_line_id uuid references shipping_lines(id),
  add column if not exists linked_countries jsonb default '[]'::jsonb;

create index if not exists enterprise_accounts_shipping_line_id_idx
  on enterprise_accounts(shipping_line_id)
  where deleted_at is null;

alter table shipping_lines
  add column if not exists linked_countries jsonb default '[]'::jsonb;

insert into erp_schema_migrations (name, status, applied_at)
values ('20261102_shipping_line_and_linked_countries', 'applied', now())
on conflict (name) do update set status = excluded.status, applied_at = excluded.applied_at;
