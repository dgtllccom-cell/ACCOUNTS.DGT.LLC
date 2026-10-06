-- Allow branch roznamcha entries to be posted at either main-branch
-- or city-branch scope. The original constraint only accepted city_branch_id,
-- which blocked main branch cash entries from the unified Cash Entry screen.

alter table if exists roznamcha_entries
  drop constraint if exists roznamcha_scope_chk;

alter table if exists roznamcha_entries
  add constraint roznamcha_scope_chk check (
    (type = 'super_admin' and country_id is null)
    or (type = 'country' and country_id is not null)
    or (type = 'branch' and (country_branch_id is not null or city_branch_id is not null))
  );

insert into erp_schema_migrations(name, status)
values ('0030_allow_main_branch_roznamcha_scope', 'applied')
on conflict (name) do nothing;
