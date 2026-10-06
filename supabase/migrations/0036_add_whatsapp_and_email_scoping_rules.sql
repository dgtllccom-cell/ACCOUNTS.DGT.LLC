-- 0036_add_whatsapp_and_email_scoping_rules.sql
-- Extension to support whatsapp_number and mandate official branch email addresses.

-- 1. Add whatsapp_number columns
alter table countries
  add column if not exists whatsapp_number text;

alter table country_branches
  add column if not exists whatsapp_number text;

alter table city_branches
  add column if not exists whatsapp_number text;

-- 2. Backfill existing null fields
update countries
  set official_email = coalesce(official_email, lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) || '@dgt.llc'),
      admin_email = coalesce(admin_email, 'admin.' || lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) || '@dgt.llc')
  where official_email is null or admin_email is null;

update country_branches
  set email = coalesce(email, lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) || '@dgt.llc')
  where email is null;

update city_branches
  set email = coalesce(email, lower(regexp_replace(name, '[^a-zA-Z0-9]', '', 'g')) || '@dgt.llc')
  where email is null;

-- 3. Set NOT NULL constraints
alter table countries
  alter column official_email set not null,
  alter column admin_email set not null;

alter table country_branches
  alter column email set not null;

alter table city_branches
  alter column email set not null;

-- 4. Apply index optimizations
create index if not exists countries_whatsapp_idx
  on countries (whatsapp_number)
  where whatsapp_number is not null;

create index if not exists country_branches_whatsapp_idx
  on country_branches (whatsapp_number)
  where whatsapp_number is not null;

create index if not exists city_branches_whatsapp_idx
  on city_branches (whatsapp_number)
  where whatsapp_number is not null;

-- 5. Record migration
insert into erp_schema_migrations (name, status)
values ('0036_add_whatsapp_and_email_scoping_rules', 'applied')
on conflict (name) do update set status = excluded.status, applied_at = now();
