-- Shipping / Clearing RBAC extension — ADDITIVE and BACKWARD-COMPATIBLE.
--
-- Goal: a Shipping Line / Clearing-agent login must see ONLY its own authorized shipping
-- transactions (reachable via shipping_line_records / shipping_bl_records for its clearing_agent),
-- never another agent's, and never the unrelated business ledger of a shared party.
--
-- Reuses (does NOT duplicate): the existing clearing_agents master, user_role_assignments RBAC,
-- the existing accounting engine (enterprise_accounts / ledgers / roznamcha), the country/branch
-- RLS helper pattern (is_super_admin / can_access_country), and the shipping_*_records tables that
-- already link to account_id / ledger_id / roznamcha_entry_id.
--
-- No existing column is dropped or repurposed. Existing rows keep existing behavior (a NULL
-- clearing_agent_id + ledger_visibility='scoped' means "ordinary country/branch user", unchanged).

-- 1) Bind a login to a specific clearing agent + record an explicit ledger-visibility grant.
--    ledger_visibility:
--      'scoped'        → ordinary country/branch user (existing behavior; agent binding ignored)
--      'shipping_only' → sees ONLY its clearing_agent's shipping transactions
--      'full'          → explicitly authorized to see the broader ledger (admin-granted)
alter table user_role_assignments
  add column if not exists clearing_agent_id uuid references clearing_agents(id);

alter table user_role_assignments
  add column if not exists ledger_visibility text not null default 'scoped';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_role_assignments_ledger_visibility_chk'
  ) then
    alter table user_role_assignments
      add constraint user_role_assignments_ledger_visibility_chk
      check (ledger_visibility in ('scoped', 'shipping_only', 'full'));
  end if;
end $$;

create index if not exists user_role_assignments_clearing_agent_idx
  on user_role_assignments (clearing_agent_id)
  where clearing_agent_id is not null and deleted_at is null;

-- 2) Tag the shipping transaction records with the clearing_agent MASTER (FK), so shipping
--    transactions become attributable to a specific agent instead of the free-text
--    shipping_line_name. The text column is kept for backward compatibility / display.
alter table shipping_line_records
  add column if not exists clearing_agent_id uuid references clearing_agents(id);

create index if not exists shipping_line_records_agent_idx
  on shipping_line_records (clearing_agent_id, created_at desc)
  where clearing_agent_id is not null and deleted_at is null;

alter table shipping_bl_records
  add column if not exists clearing_agent_id uuid references clearing_agents(id);

create index if not exists shipping_bl_records_agent_idx
  on shipping_bl_records (clearing_agent_id, created_at desc)
  where clearing_agent_id is not null and deleted_at is null;

-- 3) RLS helpers (defense-in-depth; the app's service-role connection bypasses RLS, so the
--    primary gate is the API/query layer — these protect any direct/anon access).

-- Is the current user bound to (allowed to see) the given clearing agent?
create or replace function can_access_clearing_agent(target_agent_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select is_super_admin()
    or exists (
      select 1
      from user_role_assignments ura
      where ura.user_id = auth.uid()
        and ura.clearing_agent_id = target_agent_id
        and ura.is_active = true
        and ura.deleted_at is null
    );
$$;

-- Is the current user a "shipping-only" login (bound to an agent with shipping_only visibility,
-- and NOT holding any explicit 'full' grant and not super admin)? Ordinary users return false,
-- so their existing country/branch scoping is completely unchanged.
create or replace function is_shipping_scoped_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    not is_super_admin()
    and not exists (
      select 1 from user_role_assignments f
      where f.user_id = auth.uid()
        and f.ledger_visibility = 'full'
        and f.is_active = true
        and f.deleted_at is null
    )
    and exists (
      select 1 from user_role_assignments s
      where s.user_id = auth.uid()
        and s.clearing_agent_id is not null
        and s.ledger_visibility = 'shipping_only'
        and s.is_active = true
        and s.deleted_at is null
    );
$$;

-- 4) Restrict shipping-record visibility for shipping-only users to their own agent, while
--    leaving ordinary users' country/branch access intact. Additive policies (do not remove the
--    existing country/branch policies which still apply to non-shipping users).
alter table shipping_line_records enable row level security;

drop policy if exists shipping_line_records_agent_read on shipping_line_records;
create policy shipping_line_records_agent_read on shipping_line_records
  for select using (
    is_super_admin()
    or (
      -- shipping-only users: ONLY their own agent's records
      is_shipping_scoped_user()
      and clearing_agent_id is not null
      and can_access_clearing_agent(clearing_agent_id)
    )
    or (
      -- ordinary (non-shipping) users: existing country/branch behavior
      not is_shipping_scoped_user()
      and (
        (country_id is not null and can_access_country(country_id))
        or (country_branch_id is not null and can_access_country_branch(country_branch_id))
        or (city_branch_id is not null and can_access_city_branch(city_branch_id))
      )
    )
  );

drop policy if exists shipping_bl_records_agent_read on shipping_bl_records;
create policy shipping_bl_records_agent_read on shipping_bl_records
  for select using (
    is_super_admin()
    or (
      is_shipping_scoped_user()
      and clearing_agent_id is not null
      and can_access_clearing_agent(clearing_agent_id)
    )
    or (
      not is_shipping_scoped_user()
      and (
        (country_id is not null and can_access_country(country_id))
        or (country_branch_id is not null and can_access_country_branch(country_branch_id))
        or (city_branch_id is not null and can_access_city_branch(city_branch_id))
      )
    )
  );

-- 5) Permissions for the shipping/clearing workspace surfaces (idempotent).
insert into permissions (resource, action, description)
values
  ('shipping_ledger', 'read', 'View the authorized shipping/clearing ledger for the assigned agent'),
  ('shipping_workspace', 'read', 'Access the restricted Shipping/Clearing workspace')
on conflict (resource, action) do nothing;
