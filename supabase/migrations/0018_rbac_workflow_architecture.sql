-- Enterprise ERP/FMS: RBAC workflow foundation for clearing agents, assignments,
-- record transfers, audit events, and PDF/email jobs.
-- Additive only: no destructive changes to existing branch, auth, accounting, or posting tables.

create table if not exists clearing_agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  head_office_country_id uuid references countries(id),
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists clearing_agents_code_idx
  on clearing_agents (upper(code))
  where deleted_at is null;

create table if not exists clearing_agent_branches (
  id uuid primary key default gen_random_uuid(),
  clearing_agent_id uuid not null references clearing_agents(id) on delete cascade,
  parent_id uuid references clearing_agent_branches(id),
  branch_level text not null check (branch_level in ('head_office', 'country_branch', 'city_branch')),
  name text not null,
  code text not null,
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  status text not null default 'active' check (status in ('active', 'inactive', 'suspended')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint clearing_agent_branch_scope_chk check (
    (branch_level = 'head_office')
    or (branch_level = 'country_branch' and country_id is not null)
    or (branch_level = 'city_branch' and country_id is not null and city_branch_id is not null)
  )
);

create unique index if not exists clearing_agent_branches_agent_code_idx
  on clearing_agent_branches (clearing_agent_id, upper(code))
  where deleted_at is null;

create table if not exists erp_assignments (
  id uuid primary key default gen_random_uuid(),
  assignment_no text not null,
  title text not null,
  message text,
  target_type text not null check (target_type in ('country', 'city_branch', 'clearing_agent', 'clearing_agent_branch', 'branch', 'user')),
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  clearing_agent_id uuid references clearing_agents(id),
  clearing_agent_branch_id uuid references clearing_agent_branches(id),
  assigned_to_user_id uuid references profiles(id),
  assigned_by uuid references profiles(id),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists erp_assignments_no_idx
  on erp_assignments (assignment_no)
  where deleted_at is null;

create table if not exists erp_record_transfers (
  id uuid primary key default gen_random_uuid(),
  transfer_no text not null,
  record_table text not null,
  record_id uuid not null,
  sender_user_id uuid references profiles(id),
  receiver_user_id uuid references profiles(id),
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  reason text,
  sent_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists erp_record_transfers_no_idx
  on erp_record_transfers (transfer_no)
  where deleted_at is null;

create table if not exists erp_activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  resource text not null,
  record_table text,
  record_id uuid,
  country_id uuid references countries(id),
  country_branch_id uuid references country_branches(id),
  city_branch_id uuid references city_branches(id),
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists erp_activity_events_actor_created_idx
  on erp_activity_events (actor_id, created_at desc);

create index if not exists erp_activity_events_record_idx
  on erp_activity_events (record_table, record_id, created_at desc);

create table if not exists erp_pdf_email_jobs (
  id uuid primary key default gen_random_uuid(),
  job_no text not null,
  source_table text not null,
  source_id uuid not null,
  document_title text not null,
  language_code text references languages(code),
  email_to text,
  email_subject text,
  status text not null default 'draft' check (status in ('draft', 'queued', 'sent', 'failed', 'cancelled')),
  pdf_path text,
  error_message text,
  created_by uuid references profiles(id),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists erp_pdf_email_jobs_no_idx
  on erp_pdf_email_jobs (job_no)
  where deleted_at is null;

insert into permissions (resource, action, description)
values
  ('clearing_agents', 'create', 'Create clearing agent head offices'),
  ('clearing_agents', 'read', 'View clearing agent records'),
  ('clearing_agents', 'update', 'Update clearing agent records'),
  ('clearing_agents', 'delete', 'Delete clearing agent records'),
  ('clearing_agent_branches', 'create', 'Create clearing agent country/city branches'),
  ('clearing_agent_branches', 'read', 'View clearing agent branches'),
  ('clearing_agent_branches', 'update', 'Update clearing agent branches'),
  ('assignments', 'create', 'Create alerts, tasks, and instructions'),
  ('assignments', 'read', 'View assigned alerts, tasks, and instructions'),
  ('assignments', 'update', 'Update assignment progress and status'),
  ('record_transfers', 'create', 'Transfer records to another ERP user'),
  ('record_transfers', 'read', 'View record transfer history'),
  ('record_transfers', 'approve', 'Approve or accept transferred records'),
  ('messages', 'create', 'Create ERP email/internal messages'),
  ('messages', 'read', 'View ERP email/internal messages'),
  ('settings', 'read', 'View ERP settings and master data'),
  ('settings', 'update', 'Update ERP settings and master data'),
  ('audit_logs', 'read', 'View complete ERP audit activity')
on conflict (resource, action) do nothing;

alter table clearing_agents enable row level security;
alter table clearing_agent_branches enable row level security;
alter table erp_assignments enable row level security;
alter table erp_record_transfers enable row level security;
alter table erp_activity_events enable row level security;
alter table erp_pdf_email_jobs enable row level security;

create policy clearing_agents_read_scope
  on clearing_agents for select
  using (is_super_admin() or (head_office_country_id is not null and can_access_country(head_office_country_id)));

create policy clearing_agents_super_admin_write
  on clearing_agents for all
  using (is_super_admin())
  with check (is_super_admin());

create policy clearing_agent_branches_read_scope
  on clearing_agent_branches for select
  using (
    is_super_admin()
    or (country_id is not null and can_access_country(country_id))
    or (country_branch_id is not null and can_access_country_branch(country_branch_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

create policy clearing_agent_branches_super_admin_write
  on clearing_agent_branches for all
  using (is_super_admin())
  with check (is_super_admin());

create policy erp_assignments_read_scope
  on erp_assignments for select
  using (
    is_super_admin()
    or assigned_to_user_id = auth.uid()
    or assigned_by = auth.uid()
    or (country_id is not null and can_access_country(country_id))
    or (country_branch_id is not null and can_access_country_branch(country_branch_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

create policy erp_assignments_write_scope
  on erp_assignments for all
  using (is_super_admin() or assigned_by = auth.uid())
  with check (is_super_admin() or assigned_by = auth.uid());

create policy erp_record_transfers_read_scope
  on erp_record_transfers for select
  using (
    is_super_admin()
    or sender_user_id = auth.uid()
    or receiver_user_id = auth.uid()
    or (country_id is not null and can_access_country(country_id))
    or (country_branch_id is not null and can_access_country_branch(country_branch_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

create policy erp_record_transfers_write_scope
  on erp_record_transfers for all
  using (is_super_admin() or sender_user_id = auth.uid() or receiver_user_id = auth.uid())
  with check (is_super_admin() or sender_user_id = auth.uid() or receiver_user_id = auth.uid());

create policy erp_activity_events_read_scope
  on erp_activity_events for select
  using (
    is_super_admin()
    or actor_id = auth.uid()
    or (country_id is not null and can_access_country(country_id))
    or (country_branch_id is not null and can_access_country_branch(country_branch_id))
    or (city_branch_id is not null and can_access_city_branch(city_branch_id))
  );

create policy erp_pdf_email_jobs_read_scope
  on erp_pdf_email_jobs for select
  using (is_super_admin() or created_by = auth.uid());

create policy erp_pdf_email_jobs_write_scope
  on erp_pdf_email_jobs for all
  using (is_super_admin() or created_by = auth.uid())
  with check (is_super_admin() or created_by = auth.uid());
