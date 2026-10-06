-- Branch-wise and country-wise transaction serial hardening.
-- This migration keeps the existing transaction_serial_sequences table but makes
-- prefix generation location-aware and adds scoped uniqueness guards for live transactions.

alter table if exists transaction_serial_sequences
  drop constraint if exists transaction_serial_sequences_scope_type_check;

alter table if exists transaction_serial_sequences
  add constraint transaction_serial_sequences_scope_type_check
  check (scope_type in ('global', 'country', 'branch', 'main_branch', 'city_branch', 'module_roznamcha', 'module_purchase', 'module_sales'));

create or replace function normalize_transaction_serial_prefix(
  p_scope_type text,
  p_scope_key text,
  p_prefix text
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_raw text;
  v_candidate text;
  v_country record;
  v_branch record;
  v_parts text[];
  v_part text;
begin
  v_raw := upper(coalesce(nullif(trim(p_prefix), ''), 'TXN'));

  if p_scope_type = 'country' and p_scope_key is not null then
    select iso2, iso3, name into v_country
    from countries
    where id::text = p_scope_key
    limit 1;

    if found then
      if coalesce(v_country.name, '') ilike '%United Arab Emirates%' then
        v_candidate := 'UAE';
      else
        v_candidate := coalesce(nullif(v_country.iso3, ''), nullif(v_country.iso2, ''), v_country.name, v_raw);
      end if;
      v_raw := upper(v_candidate);
    end if;
  end if;

  if p_scope_type in ('branch', 'main_branch', 'city_branch') and p_scope_key is not null then
    select code, name into v_branch
    from city_branches
    where id::text = p_scope_key
    limit 1;

    if not found then
      select code, name into v_branch
      from country_branches
      where id::text = p_scope_key
      limit 1;
    end if;

    if found then
      -- Prefer a short branch label from the branch name (e.g. CH/01 -> CH).
      -- Otherwise fall back to branch code (e.g. PAK-QTA-002 -> QTA/PKBA).
      v_candidate := upper(coalesce(v_branch.name, ''));
      v_parts := array(
        select part
        from regexp_split_to_table(regexp_replace(v_candidate, '[^A-Z0-9]+', '-', 'g'), '-') as part
        where part <> '' and part !~ '^[0-9]+$' and part not in ('BR', 'BRANCH', 'CITY', 'COUNTRY')
      );

      if array_length(v_parts, 1) >= 1 and length(v_parts[1]) between 2 and 4 then
        v_raw := v_parts[1];
      else
        v_raw := upper(coalesce(nullif(v_branch.code, ''), v_branch.name, v_raw));
      end if;
    end if;
  end if;

  v_raw := regexp_replace(v_raw, '[^A-Z0-9]+', '-', 'g');
  v_raw := trim(both '-' from v_raw);

  if p_scope_type in ('branch', 'main_branch', 'city_branch') then
    v_parts := array(
      select part
      from regexp_split_to_table(v_raw, '-') as part
      where part <> ''
        and part !~ '^[0-9]+$'
        and part not in ('BR', 'BRANCH', 'CITY', 'COUNTRY')
    );

    if array_length(v_parts, 1) >= 2 and length(v_parts[1]) between 2 and 4 then
      return substring(v_parts[2] from 1 for 6);
    end if;

    if array_length(v_parts, 1) >= 1 then
      return substring(v_parts[1] from 1 for 6);
    end if;
  end if;

  v_raw := regexp_replace(v_raw, '[^A-Z0-9]', '', 'g');
  if v_raw = '' then
    v_raw := 'TXN';
  end if;

  return substring(v_raw from 1 for 6);
end;
$$;

create or replace function next_transaction_serial(
  p_scope_type text,
  p_scope_key text,
  p_prefix text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
  v_prefix text;
  v_scope_key text;
begin
  if p_scope_type not in ('global', 'country', 'branch', 'main_branch', 'city_branch', 'module_roznamcha', 'module_purchase', 'module_sales') then
    raise exception 'Unsupported serial scope type: %', p_scope_type;
  end if;

  v_scope_key := coalesce(nullif(trim(p_scope_key), ''), 'global');
  v_prefix := normalize_transaction_serial_prefix(p_scope_type, v_scope_key, p_prefix);

  insert into transaction_serial_sequences (scope_type, scope_key, prefix, next_value)
  values (p_scope_type, v_scope_key, v_prefix, 2)
  on conflict (scope_type, scope_key)
  do update set
    next_value = transaction_serial_sequences.next_value + 1,
    prefix = excluded.prefix,
    updated_at = now()
  returning transaction_serial_sequences.next_value - 1 into v_next;

  return v_prefix || '-' || lpad(v_next::text, 6, '0');
end;
$$;

-- Scoped uniqueness: country serials are unique inside each country, branch serials inside each branch.
create unique index if not exists purchase_orders_country_serial_scoped_uidx
  on purchase_orders (country_id, country_transaction_serial_number)
  where country_id is not null and country_transaction_serial_number is not null and deleted_at is null;

create unique index if not exists purchase_orders_city_branch_serial_scoped_uidx
  on purchase_orders (city_branch_id, branch_transaction_serial_number)
  where city_branch_id is not null and branch_transaction_serial_number is not null and deleted_at is null;

create unique index if not exists purchase_orders_main_branch_serial_scoped_uidx
  on purchase_orders (country_branch_id, branch_transaction_serial_number)
  where city_branch_id is null and country_branch_id is not null and branch_transaction_serial_number is not null and deleted_at is null;

create unique index if not exists roznamcha_entries_country_serial_scoped_uidx
  on roznamcha_entries (country_id, country_transaction_serial_number)
  where country_id is not null and country_transaction_serial_number is not null and deleted_at is null;

create unique index if not exists roznamcha_entries_city_branch_serial_scoped_uidx
  on roznamcha_entries (city_branch_id, branch_transaction_serial_number)
  where city_branch_id is not null and branch_transaction_serial_number is not null and deleted_at is null;

create unique index if not exists roznamcha_entries_main_branch_serial_scoped_uidx
  on roznamcha_entries (country_branch_id, branch_transaction_serial_number)
  where city_branch_id is null and country_branch_id is not null and branch_transaction_serial_number is not null and deleted_at is null;

create unique index if not exists sales_orders_country_serial_scoped_uidx
  on sales_orders (country_id, country_transaction_serial_number)
  where country_id is not null and country_transaction_serial_number is not null and deleted_at is null;

create unique index if not exists sales_orders_city_branch_serial_scoped_uidx
  on sales_orders (city_branch_id, branch_transaction_serial_number)
  where city_branch_id is not null and branch_transaction_serial_number is not null and deleted_at is null;

create unique index if not exists sales_orders_main_branch_serial_scoped_uidx
  on sales_orders (country_branch_id, branch_transaction_serial_number)
  where city_branch_id is null and country_branch_id is not null and branch_transaction_serial_number is not null and deleted_at is null;

insert into erp_schema_migrations(name, status, applied_at)
values ('0057_branch_wise_serial_hardening', 'applied', now())
on conflict (name)
do update set status = excluded.status, applied_at = excluded.applied_at;
