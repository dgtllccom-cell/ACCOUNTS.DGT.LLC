alter table enterprise_accounts
  add column if not exists country_serial_number text,
  add column if not exists branch_serial_number text,
  add column if not exists manual_reference_number text;

with numbered as (
  select
    ea.id,
    row_number() over (
      partition by ea.country_id
      order by ea.created_at, ea.id
    ) as country_seq,
    row_number() over (
      partition by ea.scope, ea.country_id, ea.country_branch_id, ea.city_branch_id
      order by ea.created_at, ea.id
    ) as branch_seq,
    case
      when ea.scope = 'super_admin' then 'SA'
      when c.name ilike '%united arab emirates%' then 'UAE'
      when c.name ilike '%afghanistan%' then 'AFG'
      when coalesce(c.name, '') <> '' and length(upper(regexp_replace(c.name, '[^A-Za-z0-9]', '', 'g'))) >= 3 then upper(left(regexp_replace(c.name, '[^A-Za-z0-9]', '', 'g'), 3))
      when coalesce(c.iso2, '') <> '' then upper(regexp_replace(c.iso2, '[^A-Za-z0-9]', '', 'g'))
      when coalesce(c.name, '') <> '' then upper(left(regexp_replace(c.name, '[^A-Za-z0-9]', '', 'g'), 3))
      else 'CT'
    end as country_prefix,
    case
      when ea.scope = 'super_admin' then 'SUPER'
      when ea.city_branch_id is not null then coalesce(nullif(upper(left(regexp_replace(coalesce(cb.city_name, cb.name, cb.code), '[^A-Za-z0-9]', '', 'g'), 3)), ''), 'CITY')
      when ea.country_branch_id is not null then 'MAIN'
      else coalesce(nullif(upper(regexp_replace(c.iso2, '[^A-Za-z0-9]', '', 'g')), ''), 'BRANCH')
    end as branch_prefix
  from enterprise_accounts ea
  left join countries c on c.id = ea.country_id
  left join country_branches cbr on cbr.id = ea.country_branch_id
  left join city_branches cb on cb.id = ea.city_branch_id
  where ea.deleted_at is null
)
update enterprise_accounts ea
set
  country_serial_number = coalesce(ea.country_serial_number, numbered.country_prefix || '-' || lpad(numbered.country_seq::text, 6, '0')),
  branch_serial_number = coalesce(ea.branch_serial_number, numbered.country_prefix || '-' || numbered.branch_prefix || '-' || lpad(numbered.branch_seq::text, 6, '0'))
from numbered
where ea.id = numbered.id;

alter table enterprise_accounts
  alter column country_serial_number set not null,
  alter column branch_serial_number set not null;

create index if not exists enterprise_accounts_country_serial_number_idx
  on enterprise_accounts(country_id, country_serial_number)
  where deleted_at is null;

create index if not exists enterprise_accounts_branch_serial_number_idx
  on enterprise_accounts(scope, country_id, country_branch_id, city_branch_id, branch_serial_number)
  where deleted_at is null;

create unique index if not exists enterprise_accounts_manual_reference_number_idx
  on enterprise_accounts(manual_reference_number)
  where manual_reference_number is not null and deleted_at is null;

create index if not exists enterprise_accounts_reference_lookup_idx
  on enterprise_accounts(account_number, manual_reference_number, customer_number)
  where deleted_at is null;

alter table ledger_posting_lines
  add column if not exists account_number text,
  add column if not exists manual_reference_number text;

alter table roznamcha_lines
  add column if not exists account_number text,
  add column if not exists manual_reference_number text;

update ledger_posting_lines lpl
set
  account_number = coalesce(lpl.account_number, ea.account_number),
  manual_reference_number = coalesce(lpl.manual_reference_number, ea.manual_reference_number)
from enterprise_accounts ea
where lpl.enterprise_account_id = ea.id;

update roznamcha_lines rl
set
  account_number = coalesce(rl.account_number, ea.account_number),
  manual_reference_number = coalesce(rl.manual_reference_number, ea.manual_reference_number)
from enterprise_accounts ea
where rl.enterprise_account_id = ea.id;

create index if not exists ledger_posting_lines_account_reference_idx
  on ledger_posting_lines(account_number, manual_reference_number);

create index if not exists roznamcha_lines_account_reference_idx
  on roznamcha_lines(account_number, manual_reference_number);

create or replace function sync_account_reference_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  account_record record;
begin
  if new.enterprise_account_id is not null then
    select account_number, manual_reference_number
    into account_record
    from enterprise_accounts
    where id = new.enterprise_account_id;

    new.account_number := coalesce(new.account_number, account_record.account_number);
    new.manual_reference_number := coalesce(new.manual_reference_number, account_record.manual_reference_number);
  end if;

  return new;
end;
$$;

drop trigger if exists ledger_posting_lines_account_reference_sync on ledger_posting_lines;
create trigger ledger_posting_lines_account_reference_sync
before insert or update of enterprise_account_id, account_number, manual_reference_number
on ledger_posting_lines
for each row
execute function sync_account_reference_columns();

drop trigger if exists roznamcha_lines_account_reference_sync on roznamcha_lines;
create trigger roznamcha_lines_account_reference_sync
before insert or update of enterprise_account_id, account_number, manual_reference_number
on roznamcha_lines
for each row
execute function sync_account_reference_columns();

insert into erp_schema_migrations(name, status, applied_at)
values ('0026_account_master_references', 'applied', now())
on conflict (name) do update set status = excluded.status, applied_at = excluded.applied_at;
