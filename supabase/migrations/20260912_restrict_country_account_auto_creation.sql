-- Restrict auto_create_country_account trigger function to only the 4 authorized operating countries:
-- Pakistan (PK), United Arab Emirates (AE), Afghanistan (AF), India (IN)

create or replace function public.auto_create_country_account()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_main_ledger_id uuid;
  v_inter_ledger_id uuid;
  v_invest_ledger_id uuid;
  v_currency text;
begin
  -- Only create country accounts for authorized operating countries
  if coalesce(NEW.iso2, '') NOT IN ('PK', 'AE', 'AF', 'IN') then
    return NEW;
  end if;

  -- Skip if a country_account already exists
  if exists (select 1 from public.country_accounts where country_id = NEW.id and deleted_at is null) then
    return NEW;
  end if;

  v_currency := coalesce(NEW.currency_code, 'USD');

  -- Create Main Country Account ledger
  insert into public.ledgers (scope, country_id, code, name, currency, normal_balance)
  values ('country', NEW.id, 'CT-MAIN-' || coalesce(NEW.iso2, left(NEW.name, 3)),
          NEW.name || ' Main Account', v_currency, 'debit')
  returning id into v_main_ledger_id;

  -- Create Inter-Country Account ledger
  insert into public.ledgers (scope, country_id, code, name, currency, normal_balance)
  values ('country', NEW.id, 'CT-INTER-' || coalesce(NEW.iso2, left(NEW.name, 3)),
          NEW.name || ' Inter-Country Account', v_currency, 'debit')
  returning id into v_inter_ledger_id;

  -- Create Investment Account ledger
  insert into public.ledgers (scope, country_id, code, name, currency, normal_balance)
  values ('country', NEW.id, 'CT-INVEST-' || coalesce(NEW.iso2, left(NEW.name, 3)),
          NEW.name || ' Investment Account', 'USD', 'credit')
  returning id into v_invest_ledger_id;

  -- Create the country_accounts record
  insert into public.country_accounts (country_id, main_account_ledger_id, inter_country_ledger_id, investment_ledger_id)
  values (NEW.id, v_main_ledger_id, v_inter_ledger_id, v_invest_ledger_id);

  return NEW;
end;
$$;
