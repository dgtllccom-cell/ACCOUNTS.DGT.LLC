alter table enterprise_accounts
  add column if not exists contacts jsonb default '[]'::jsonb;
