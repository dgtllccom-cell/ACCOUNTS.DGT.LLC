-- Enterprise ERP/FMS: user_role_assignments scope constraint alignment
-- The enum app_role was extended, but the original scope CHECK constraint only allowed legacy roles.
-- This updates the constraint to support enterprise roles while preserving the hierarchy rules.

alter table user_role_assignments
  drop constraint if exists user_role_scope_chk;

alter table user_role_assignments
  add constraint user_role_scope_chk check (
    (role = 'super_admin' and country_id is null and country_branch_id is null and city_branch_id is null)
    or (role = 'country_admin' and country_id is not null and country_branch_id is null and city_branch_id is null)
    or (role = 'main_branch_admin' and country_id is not null and country_branch_id is not null and city_branch_id is null)
    or (
      role in ('city_branch_admin', 'branch_admin', 'accountant', 'cashier', 'agent_user')
      and country_id is not null
      and country_branch_id is not null
      and city_branch_id is not null
    )
    or (role = 'staff' and country_id is not null)
    or (role = 'auditor_viewer' and country_id is not null)
  );

