-- Enterprise ERP/FMS: Country User role support
-- Country User is a country-scoped, non-admin role. It can only access data for its assigned country.

alter type app_role add value if not exists 'country_user';

alter table user_role_assignments
  drop constraint if exists user_role_scope_chk;

alter table user_role_assignments
  add constraint user_role_scope_chk check (
    (role = 'super_admin' and country_id is null and country_branch_id is null and city_branch_id is null)
    or (role = 'country_admin' and country_id is not null and country_branch_id is null and city_branch_id is null)
    or (role::text = 'country_user' and country_id is not null and country_branch_id is null and city_branch_id is null)
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

insert into erp_role_templates (code, name, scope_level, description, is_system)
select 'country_user', 'Country User', 'country', 'Country-scoped user with read/report access to assigned country data.', true
where not exists (
  select 1 from erp_role_templates where code = 'country_user'
);
