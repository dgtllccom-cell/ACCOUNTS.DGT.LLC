-- ERP/FMS: Contact Type master data + country calling-code rules
-- Centralized reusable master-data for phone/mobile/WhatsApp/fax/extension prefixes.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'contact_type_key') then
    create type contact_type_key as enum ('mobile', 'phone', 'whatsapp', 'fax', 'extension');
  end if;
end $$;

create table if not exists contact_types (
  id uuid primary key default gen_random_uuid(),
  key contact_type_key not null unique,
  name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists country_contact_type_rules (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id),
  contact_type_id uuid not null references contact_types(id),
  calling_code text not null,
  prefix text,
  format_mask text,
  example text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint country_contact_type_rules_unique unique (country_id, contact_type_id),
  -- Must be like +92, +971, etc. Note: regex needs `\+` (not `\\+`) to match a literal plus.
  constraint country_contact_type_rules_calling_code_chk check (calling_code ~ '^\+[0-9]{1,6}$')
);

create index if not exists country_contact_type_rules_country_idx
  on country_contact_type_rules (country_id)
  where deleted_at is null;

-- Seed base contact types (idempotent).
insert into contact_types (key, name, sort_order)
values
  ('mobile', 'Mobile', 10),
  ('phone', 'Phone', 20),
  ('whatsapp', 'WhatsApp', 30),
  ('fax', 'Fax', 40),
  ('extension', 'Extension', 50)
on conflict (key) do update
  set name = excluded.name,
      sort_order = excluded.sort_order,
      updated_at = now();

-- Seed calling codes for our initial countries (best-effort; safe if country not present).
with ct as (
  select id, key from contact_types where deleted_at is null
),
seed as (
  select c.id as country_id, ct.id as contact_type_id,
         case
           when lower(c.name) like 'pakistan%' then '+92'
           when lower(c.name) like '%united arab emirates%' or lower(c.name) like '%uae%' or lower(c.name) like '%dubai%' then '+971'
           when lower(c.name) like 'india%' then '+91'
           when lower(c.name) like 'iran%' then '+98'
           when lower(c.name) like 'afghanistan%' then '+93'
           else null
         end as calling_code
  from countries c
  cross join ct
  where ct.key in ('mobile','phone','whatsapp','fax')
    and c.deleted_at is null
)
insert into country_contact_type_rules (country_id, contact_type_id, calling_code, created_at, updated_at)
select s.country_id, s.contact_type_id, s.calling_code, now(), now()
from seed s
where s.calling_code is not null
on conflict (country_id, contact_type_id) do update
  set calling_code = excluded.calling_code,
      updated_at = now();

alter table contact_types enable row level security;
alter table country_contact_type_rules enable row level security;

-- Everyone signed-in can read contact types (they are global).
create policy contact_types_read on contact_types
  for select
  using (auth.uid() is not null);

-- Only Super Admin manages contact types and rules.
create policy contact_types_write on contact_types
  for all
  using (is_super_admin())
  with check (is_super_admin());

-- Country rules are readable only within accessible country scope.
create policy country_contact_type_rules_read on country_contact_type_rules
  for select
  using (can_access_country(country_id));

create policy country_contact_type_rules_write on country_contact_type_rules
  for all
  using (is_super_admin())
  with check (is_super_admin());
