-- Add "Consignee" as a genuine party role on the Customer Order flow, mirroring
-- the existing exporter/importer/notify_party/buyer party-name columns.
alter table clearing_customer_orders
  add column if not exists consignee_name text;

insert into public.translation_field_registry (table_name, field_name, mode) values
  ('clearing_customer_orders', 'consignee_name', 'transliterate')
on conflict (table_name, field_name) do nothing;

-- Widen the party-role CHECK constraint so "consignee" is a valid PartyRoleKey
-- alongside supplier/importer/exporter/notify_party/buyer.
alter table clearing_customer_order_parties drop constraint if exists clearing_customer_order_parties_role_key_check;
alter table clearing_customer_order_parties
  add constraint clearing_customer_order_parties_role_key_check
  check (role_key = any (array['supplier','importer','exporter','notify_party','buyer','consignee']));
