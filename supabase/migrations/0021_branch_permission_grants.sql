alter table if exists country_branches
  add column if not exists permission_template text,
  add column if not exists permission_grants jsonb not null default '[]'::jsonb;

alter table if exists city_branches
  add column if not exists permission_template text,
  add column if not exists permission_grants jsonb not null default '[]'::jsonb;

create index if not exists idx_country_branches_permission_grants
  on country_branches using gin (permission_grants);

create index if not exists idx_city_branches_permission_grants
  on city_branches using gin (permission_grants);

notify pgrst, 'reload schema';
