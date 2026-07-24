do $$
begin
  create type language_direction as enum ('ltr', 'rtl');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type translation_source as enum ('auto', 'manual', 'imported');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type approval_action_type as enum ('edit', 'delete', 'update', 'reverse', 'lock', 'unlock');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type approval_status as enum ('draft', 'pending', 'approved', 'rejected', 'applied', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type branch_level as enum ('super_admin', 'country', 'main_branch', 'city_branch', 'agent');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type ledger_scope as enum ('super_admin', 'country', 'main_branch', 'city_branch');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type roznamcha_type as enum ('super_admin', 'country', 'branch');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type payment_entry_type as enum (
    'cash_payment',
    'cash_receipt',
    'bank_cheque',
    'bank_deposit',
    'transfer',
    'debit',
    'credit'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type report_run_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type erp_module_status as enum ('planned', 'active', 'paused', 'retired');
exception
  when duplicate_object then null;
end $$;

alter table countries
  add column if not exists default_language_code text default 'en',
  add column if not exists default_country_branch_id uuid references country_branches(id);

alter table profiles
  add column if not exists preferred_language_code text default 'en';

create table if not exists languages (
  code text primary key,
  english_name text not null,
  native_name text not null,
  direction language_direction not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table countries
  add constraint countries_default_language_fk
  foreign key (default_language_code) references languages(code)
  not valid;

alter table profiles
  add constraint profiles_preferred_language_fk
  foreign key (preferred_language_code) references languages(code)
  not valid;

create table if not exists user_language_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  language_code text not null references languages(code),
  direction language_direction not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists user_language_preferences_active_idx
  on user_language_preferences (user_id)
  where is_active = true and deleted_at is null;

create table if not exists translation_keys (
  id uuid primary key default gen_random_uuid(),
  namespace text not null,
  key text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists translation_keys_namespace_key_idx
  on translation_keys (namespace, key)
  where deleted_at is null;

create table if not exists translation_values (
  id uuid primary key default gen_random_uuid(),
  translation_key_id uuid not null references translation_keys(id) on delete cascade,
  language_code text not null references languages(code),
  value text not null,
  source translation_source not null default 'manual',
  corrected_by uuid references profiles(id),
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists translation_values_key_language_idx
  on translation_values (translation_key_id, language_code)
  where deleted_at is null;

create table if not exists record_translations (
  id uuid primary key default gen_random_uuid(),
  record_table text not null,
  record_id uuid not null,
  field_name text not null,
  original_text text not null,
  original_language_code text not null references languages(code),
  english_text text,
  arabic_text text,
  urdu_text text,
  persian_text text,
  pashto_text text,
  source translation_source not null default 'auto',
  corrected_by uuid references profiles(id),
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists record_translations_field_idx
  on record_translations (record_table, record_id, field_name)
  where deleted_at is null;

create table if not exists translation_audit_logs (
  id uuid primary key default gen_random_uuid(),
  record_translation_id uuid references record_translations(id),
  actor_id uuid references profiles(id),
  before jsonb,
  after jsonb,
  action text not null,
  created_at timestamptz not null default now()
);

create table if not exists states_provinces (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id),
  name text not null,
  code text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists states_provinces_country_name_idx
  on states_provinces (country_id, lower(name))
  where deleted_at is null;

create table if not exists cities (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id),
  state_province_id uuid references states_provinces(id),
  name text not null,
  code text,
  zip_code text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists cities_country_state_name_idx
  on cities (country_id, coalesce(state_province_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where deleted_at is null;

create table if not exists areas_locations (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id),
  state_province_id uuid references states_provinces(id),
  city_id uuid not null references cities(id),
  name text not null,
  code text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists areas_locations_city_name_idx
  on areas_locations (city_id, lower(name))
  where deleted_at is null;

create table if not exists approval_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null,
  action approval_action_type not null,
  status approval_status not null default 'pending',
  target_table text not null,
  target_id uuid not null,
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  requested_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  rejected_by uuid references profiles(id),
  decided_at timestamptz,
  reason text,
  rejection_reason text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists approval_requests_no_idx
  on approval_requests (request_no)
  where deleted_at is null;

create index if not exists approval_requests_target_idx
  on approval_requests (target_table, target_id);

create table if not exists approval_request_items (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references approval_requests(id) on delete cascade,
  field_name text,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create table if not exists approval_status_history (
  id uuid primary key default gen_random_uuid(),
  approval_request_id uuid not null references approval_requests(id) on delete cascade,
  from_status approval_status,
  to_status approval_status not null,
  actor_id uuid references profiles(id),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists record_locks (
  id uuid primary key default gen_random_uuid(),
  record_table text not null,
  record_id uuid not null,
  approval_request_id uuid references approval_requests(id),
  locked_by uuid references profiles(id),
  locked_reason text,
  locked_at timestamptz not null default now(),
  unlocked_by uuid references profiles(id),
  unlocked_at timestamptz,
  is_active boolean not null default true
);

create unique index if not exists record_locks_active_idx
  on record_locks (record_table, record_id)
  where is_active = true;

create table if not exists soft_delete_logs (
  id uuid primary key default gen_random_uuid(),
  record_table text not null,
  record_id uuid not null,
  country_id uuid references countries(id),
  city_branch_id uuid references city_branches(id),
  deleted_by uuid references profiles(id),
  approval_request_id uuid references approval_requests(id),
  reason text,
  deleted_at timestamptz not null default now(),
  restore_by uuid references profiles(id),
  restored_at timestamptz
);

create table if not exists record_change_history (
  id uuid primary key default gen_random_uuid(),
  record_table text not null,
  record_id uuid not null,
  country_id uuid references countries(id),
  city_branch_id uuid references city_branches(id),
  action text not null,
  actor_id uuid references profiles(id),
  approval_request_id uuid references approval_requests(id),
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists erp_role_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  scope_level branch_level not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists erp_role_templates_code_idx
  on erp_role_templates (code)
  where deleted_at is null;

create table if not exists erp_role_template_permissions (
  role_template_id uuid not null references erp_role_templates(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_template_id, permission_id)
);

create table if not exists account_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  account_kind account_kind not null,
  parent_id uuid references account_groups(id),
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists account_groups_code_idx
  on account_groups (code)
  where deleted_at is null;

create table if not exists account_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  account_kind account_kind not null,
  account_group_id uuid references account_groups(id),
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists account_types_code_idx
  on account_types (code)
  where deleted_at is null;

create table if not exists ledgers (
  id uuid primary key default gen_random_uuid(),
  scope ledger_scope not null,
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  account_id uuid references accounts(id),
  code text not null,
  name text not null,
  currency text not null,
  opening_balance numeric(18, 4) not null default 0,
  current_balance numeric(18, 4) not null default 0,
  debit_total numeric(18, 4) not null default 0,
  credit_total numeric(18, 4) not null default 0,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ledgers_scope_chk check (
    (scope = 'super_admin' and country_id is null and city_branch_id is null)
    or (scope = 'country' and country_id is not null)
    or (scope = 'main_branch' and country_branch_id is not null)
    or (scope = 'city_branch' and city_branch_id is not null)
  )
);

create unique index if not exists ledgers_scope_code_idx
  on ledgers (
    scope,
    coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    code
  )
  where deleted_at is null;

create table if not exists ledger_balances (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references ledgers(id),
  balance_date date not null,
  opening_balance numeric(18, 4) not null default 0,
  debit_total numeric(18, 4) not null default 0,
  credit_total numeric(18, 4) not null default 0,
  closing_balance numeric(18, 4) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ledger_balances_day_idx
  on ledger_balances (ledger_id, balance_date);

create table if not exists journal_reversals (
  id uuid primary key default gen_random_uuid(),
  original_journal_entry_id uuid not null references journal_entries(id),
  reversal_journal_entry_id uuid not null references journal_entries(id),
  reason text not null,
  approval_request_id uuid references approval_requests(id),
  reversed_by uuid references profiles(id),
  reversed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists journal_reversals_original_idx
  on journal_reversals (original_journal_entry_id);

create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  is_bank_required boolean not null default false,
  is_reference_required boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists payment_methods_code_idx
  on payment_methods (code)
  where deleted_at is null;

create table if not exists voucher_sequences (
  id uuid primary key default gen_random_uuid(),
  scope ledger_scope not null,
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  prefix text not null,
  next_number bigint not null default 1,
  padding integer not null default 6,
  reset_policy text not null default 'yearly',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists voucher_sequences_scope_prefix_idx
  on voucher_sequences (
    scope,
    coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    prefix
  )
  where deleted_at is null;

create table if not exists roznamcha_entries (
  id uuid primary key default gen_random_uuid(),
  type roznamcha_type not null,
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  journal_entry_id uuid references journal_entries(id),
  journal_no text not null,
  voucher_no text not null,
  entry_date date not null,
  payment_method_id uuid references payment_methods(id),
  reference_no text,
  narration text,
  status document_status not null default 'draft',
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint roznamcha_scope_chk check (
    (type = 'super_admin' and country_id is null)
    or (type = 'country' and country_id is not null)
    or (type = 'branch' and city_branch_id is not null)
  )
);

create unique index if not exists roznamcha_entries_voucher_idx
  on roznamcha_entries (voucher_no)
  where deleted_at is null;

create table if not exists roznamcha_lines (
  id uuid primary key default gen_random_uuid(),
  roznamcha_entry_id uuid not null references roznamcha_entries(id) on delete cascade,
  payment_entry_type payment_entry_type not null,
  account_id uuid references accounts(id),
  ledger_id uuid references ledgers(id),
  description text,
  debit numeric(18, 4) not null default 0,
  credit numeric(18, 4) not null default 0,
  currency text not null,
  usd_rate numeric(18, 8) not null default 1,
  usd_amount numeric(18, 4) not null default 0,
  constraint roznamcha_lines_one_side_chk check (
    (debit > 0 and credit = 0) or (credit > 0 and debit = 0)
  )
);

create table if not exists daily_usd_rates (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id),
  country_branch_id uuid references country_branches(id),
  rate_date date not null,
  buying_rate numeric(18, 8) not null,
  selling_rate numeric(18, 8) not null,
  credit_rate numeric(18, 8) not null,
  debit_rate numeric(18, 8) not null,
  entered_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  approval_request_id uuid references approval_requests(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint daily_usd_rates_positive_chk check (
    buying_rate > 0 and selling_rate > 0 and credit_rate > 0 and debit_rate > 0
  )
);

create unique index if not exists daily_usd_rates_country_day_idx
  on daily_usd_rates (country_id, rate_date)
  where deleted_at is null;

create table if not exists usd_purchase_sales (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  business_date date not null,
  opening_balance numeric(18, 4) not null default 0,
  usd_purchased numeric(18, 4) not null default 0,
  usd_sold numeric(18, 4) not null default 0,
  purchase_rate numeric(18, 8) not null default 1,
  sale_rate numeric(18, 8) not null default 1,
  debit_amount numeric(18, 4) not null default 0,
  credit_amount numeric(18, 4) not null default 0,
  closing_balance numeric(18, 4) not null default 0,
  profit_loss numeric(18, 4) not null default 0,
  created_by uuid references profiles(id),
  approved_by uuid references profiles(id),
  approval_request_id uuid references approval_requests(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists exchange_rate_history (
  id uuid primary key default gen_random_uuid(),
  country_id uuid references countries(id),
  from_currency text not null,
  to_currency text not null default 'USD',
  old_rate numeric(18, 8),
  new_rate numeric(18, 8) not null,
  effective_date date not null,
  changed_by uuid references profiles(id),
  approval_request_id uuid references approval_requests(id),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists management_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists management_categories_code_idx
  on management_categories (code)
  where deleted_at is null;

create table if not exists management_parameters (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references management_categories(id),
  code text not null,
  name text not null,
  description text,
  data_type text not null default 'text',
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists management_parameters_category_code_idx
  on management_parameters (category_id, code)
  where deleted_at is null;

create table if not exists management_parameter_values (
  id uuid primary key default gen_random_uuid(),
  parameter_id uuid not null references management_parameters(id),
  parent_value_id uuid references management_parameter_values(id),
  code text,
  value text not null,
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists management_parameter_values_code_idx
  on management_parameter_values (parameter_id, lower(coalesce(code, value)))
  where deleted_at is null;

create table if not exists report_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  module_code text,
  description text,
  default_currency text not null default 'USD',
  supports_pdf boolean not null default true,
  supports_excel boolean not null default true,
  supports_print boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint report_definitions_currency_chk check (default_currency = 'USD')
);

create unique index if not exists report_definitions_code_idx
  on report_definitions (code)
  where deleted_at is null;

create table if not exists report_runs (
  id uuid primary key default gen_random_uuid(),
  report_definition_id uuid not null references report_definitions(id),
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  language_code text references languages(code),
  status report_run_status not null default 'queued',
  filters jsonb not null default '{}'::jsonb,
  requested_by uuid references profiles(id),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists report_exports (
  id uuid primary key default gen_random_uuid(),
  report_run_id uuid not null references report_runs(id) on delete cascade,
  export_type text not null,
  storage_bucket text,
  storage_path text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists report_snapshots (
  id uuid primary key default gen_random_uuid(),
  report_run_id uuid not null references report_runs(id) on delete cascade,
  currency text not null default 'USD',
  totals jsonb not null default '{}'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint report_snapshots_currency_chk check (currency = 'USD')
);

create table if not exists erp_modules (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  status erp_module_status not null default 'planned',
  is_financial boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists erp_modules_code_idx
  on erp_modules (code)
  where deleted_at is null;

create table if not exists module_dependencies (
  module_id uuid not null references erp_modules(id) on delete cascade,
  depends_on_module_id uuid not null references erp_modules(id) on delete cascade,
  primary key (module_id, depends_on_module_id)
);

create table if not exists module_settings (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references erp_modules(id) on delete cascade,
  setting_key text not null,
  setting_value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists module_settings_key_idx
  on module_settings (module_id, setting_key);

create table if not exists module_number_sequences (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references erp_modules(id) on delete cascade,
  country_id uuid references countries(id),
  city_branch_id uuid references city_branches(id),
  sequence_key text not null,
  prefix text not null,
  next_number bigint not null default 1,
  padding integer not null default 6,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists module_number_sequences_scope_idx
  on module_number_sequences (
    module_id,
    coalesce(country_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(city_branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
    sequence_key
  )
  where deleted_at is null;

create table if not exists module_audit_rules (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references erp_modules(id) on delete cascade,
  action text not null,
  requires_approval boolean not null default false,
  writes_ledger boolean not null default false,
  writes_audit boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists module_audit_rules_action_idx
  on module_audit_rules (module_id, action);

alter table languages enable row level security;
alter table user_language_preferences enable row level security;
alter table translation_keys enable row level security;
alter table translation_values enable row level security;
alter table record_translations enable row level security;
alter table translation_audit_logs enable row level security;
alter table states_provinces enable row level security;
alter table cities enable row level security;
alter table areas_locations enable row level security;
alter table approval_requests enable row level security;
alter table approval_request_items enable row level security;
alter table approval_status_history enable row level security;
alter table record_locks enable row level security;
alter table soft_delete_logs enable row level security;
alter table record_change_history enable row level security;
alter table erp_role_templates enable row level security;
alter table erp_role_template_permissions enable row level security;
alter table account_groups enable row level security;
alter table account_types enable row level security;
alter table ledgers enable row level security;
alter table ledger_balances enable row level security;
alter table journal_reversals enable row level security;
alter table payment_methods enable row level security;
alter table voucher_sequences enable row level security;
alter table roznamcha_entries enable row level security;
alter table roznamcha_lines enable row level security;
alter table daily_usd_rates enable row level security;
alter table usd_purchase_sales enable row level security;
alter table exchange_rate_history enable row level security;
alter table management_categories enable row level security;
alter table management_parameters enable row level security;
alter table management_parameter_values enable row level security;
alter table report_definitions enable row level security;
alter table report_runs enable row level security;
alter table report_exports enable row level security;
alter table report_snapshots enable row level security;
alter table erp_modules enable row level security;
alter table module_dependencies enable row level security;
alter table module_settings enable row level security;
alter table module_number_sequences enable row level security;
alter table module_audit_rules enable row level security;

create policy languages_read_all on languages for select using (true);
create policy translation_keys_read_all on translation_keys for select using (true);
create policy translation_values_read_all on translation_values for select using (true);
create policy management_categories_read_all on management_categories for select using (true);
create policy management_parameters_read_all on management_parameters for select using (true);
create policy management_parameter_values_read_all on management_parameter_values for select using (true);
create policy erp_modules_read_all on erp_modules for select using (true);
create policy report_definitions_read_all on report_definitions for select using (true);
create policy account_groups_read_all on account_groups for select using (true);
create policy account_types_read_all on account_types for select using (true);
create policy payment_methods_read_all on payment_methods for select using (true);

create policy user_language_preferences_self_read on user_language_preferences
  for select using (user_id = auth.uid() or is_super_admin());

create policy user_language_preferences_self_write on user_language_preferences
  for all using (user_id = auth.uid() or is_super_admin())
  with check (user_id = auth.uid() or is_super_admin());

create policy states_scope_read on states_provinces
  for select using (is_super_admin() or can_access_country(country_id));

create policy cities_scope_read on cities
  for select using (is_super_admin() or can_access_country(country_id));

create policy areas_scope_read on areas_locations
  for select using (is_super_admin() or can_access_country(country_id));

create policy location_admin_write on states_provinces
  for all using (is_super_admin() or can_manage_country(country_id))
  with check (is_super_admin() or can_manage_country(country_id));

create policy cities_admin_write on cities
  for all using (is_super_admin() or can_manage_country(country_id))
  with check (is_super_admin() or can_manage_country(country_id));

create policy areas_admin_write on areas_locations
  for all using (is_super_admin() or can_manage_country(country_id))
  with check (is_super_admin() or can_manage_country(country_id));

create policy approval_scope_read on approval_requests
  for select using (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
    or requested_by = auth.uid()
  );

create policy approval_super_admin_write on approval_requests
  for all using (is_super_admin())
  with check (is_super_admin() or requested_by = auth.uid());

create policy ledgers_scope_read on ledgers
  for select using (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

create policy roznamcha_scope_read on roznamcha_entries
  for select using (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

create policy daily_usd_rates_scope_read on daily_usd_rates
  for select using (is_super_admin() or can_access_country(country_id));

create policy daily_usd_rates_admin_write on daily_usd_rates
  for all using (is_super_admin() or can_manage_country(country_id))
  with check (is_super_admin() or can_manage_country(country_id));
