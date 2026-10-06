alter table ledger_posting_lines
  add column if not exists customer_number text,
  add column if not exists country_serial_number text,
  add column if not exists branch_serial_number text;

alter table roznamcha_lines
  add column if not exists customer_number text,
  add column if not exists country_serial_number text,
  add column if not exists branch_serial_number text;

update ledger_posting_lines lpl
set
  account_number = coalesce(lpl.account_number, ea.account_number),
  manual_reference_number = coalesce(lpl.manual_reference_number, ea.manual_reference_number),
  customer_number = coalesce(lpl.customer_number, ea.customer_number),
  country_serial_number = coalesce(lpl.country_serial_number, ea.country_serial_number),
  branch_serial_number = coalesce(lpl.branch_serial_number, ea.branch_serial_number)
from enterprise_accounts ea
where lpl.enterprise_account_id = ea.id;

update roznamcha_lines rl
set
  account_number = coalesce(rl.account_number, ea.account_number),
  manual_reference_number = coalesce(rl.manual_reference_number, ea.manual_reference_number),
  customer_number = coalesce(rl.customer_number, ea.customer_number),
  country_serial_number = coalesce(rl.country_serial_number, ea.country_serial_number),
  branch_serial_number = coalesce(rl.branch_serial_number, ea.branch_serial_number)
from enterprise_accounts ea
where rl.enterprise_account_id = ea.id;

create index if not exists ledger_posting_lines_identity_traceability_idx
  on ledger_posting_lines(account_number, manual_reference_number, customer_number, country_serial_number, branch_serial_number);

create index if not exists roznamcha_lines_identity_traceability_idx
  on roznamcha_lines(account_number, manual_reference_number, customer_number, country_serial_number, branch_serial_number);

create or replace function sync_account_reference_columns()
returns trigger
language plpgsql
as $$
declare
  account_record record;
begin
  if new.enterprise_account_id is not null then
    select
      account_number,
      manual_reference_number,
      customer_number,
      country_serial_number,
      branch_serial_number
    into account_record
    from enterprise_accounts
    where id = new.enterprise_account_id;

    new.account_number := coalesce(new.account_number, account_record.account_number);
    new.manual_reference_number := coalesce(new.manual_reference_number, account_record.manual_reference_number);
    new.customer_number := coalesce(new.customer_number, account_record.customer_number);
    new.country_serial_number := coalesce(new.country_serial_number, account_record.country_serial_number);
    new.branch_serial_number := coalesce(new.branch_serial_number, account_record.branch_serial_number);
  end if;

  return new;
end;
$$;

drop trigger if exists ledger_posting_lines_account_reference_sync on ledger_posting_lines;
create trigger ledger_posting_lines_account_reference_sync
before insert or update of enterprise_account_id, account_number, manual_reference_number, customer_number, country_serial_number, branch_serial_number
on ledger_posting_lines
for each row execute function sync_account_reference_columns();

drop trigger if exists roznamcha_lines_account_reference_sync on roznamcha_lines;
create trigger roznamcha_lines_account_reference_sync
before insert or update of enterprise_account_id, account_number, manual_reference_number, customer_number, country_serial_number, branch_serial_number
on roznamcha_lines
for each row execute function sync_account_reference_columns();

insert into erp_schema_migrations (name, status)
values ('0027_transaction_identity_traceability', 'applied')
on conflict (name) do update
  set status = excluded.status,
      applied_at = now();
