-- Migration: Email Drafts Storage
-- Purpose: Store draft emails locally (backup for IMAP Drafts folder)

create table if not exists erp_email_drafts (
  id uuid default gen_random_uuid() primary key,
  account_id uuid not null references erp_email_accounts(id) on delete cascade,

  -- Email content
  subject text not null,
  body text not null,
  to_address text not null,
  cc_address text,
  bcc_address text,

  -- Metadata
  created_by uuid references auth.users(id),
  created_at timestamp default now(),
  updated_at timestamp default now(),
  deleted_at timestamp,

  -- Constraints
  constraint draft_no_empty_subject check (subject <> ''),
  constraint draft_no_empty_body check (body <> ''),
  constraint draft_valid_recipient check (to_address ~* '^[^@]+@[^@]+\.[^@]+$')
);

-- Indexes
create index idx_email_drafts_account on erp_email_drafts(account_id);
create index idx_email_drafts_created_by on erp_email_drafts(created_by);
create index idx_email_drafts_deleted on erp_email_drafts(deleted_at);

-- RLS Policy: Users can see only their own drafts or drafts for accounts they can access
alter table erp_email_drafts enable row level security;

create policy "Users can manage their own account drafts"
  on erp_email_drafts
  for all
  using (
    auth.uid() = created_by
    or exists (
      select 1 from erp_email_accounts acc
      where acc.id = erp_email_drafts.account_id
      and (
        -- Super admin or
        exists (select 1 from user_role_assignments where user_id = auth.uid() and role = 'super_admin')
        -- Or country admin for their country
        or exists (
          select 1 from user_role_assignments ura
          where ura.user_id = auth.uid()
          and ura.role = 'country_admin'
          and acc.country_id = ura.country_id
        )
        -- Or branch user for their branch
        or exists (
          select 1 from user_role_assignments ura
          where ura.user_id = auth.uid()
          and ura.role in ('branch_user', 'branch_admin')
          and (
            acc.city_branch_id = ura.city_branch_id
            or acc.country_branch_id = ura.country_branch_id
          )
        )
      )
    )
  );

-- Audit trigger
create trigger email_drafts_audit_trigger
  after insert or update on erp_email_drafts
  for each row
  execute function audit_trigger_func('email_drafts', 'account_id');

-- Update schema migrations registry
insert into erp_schema_migrations (name, status)
values ('0072_email_drafts_table', 'applied')
on conflict (name) do update set status = excluded.status, applied_at = now();
