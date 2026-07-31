-- 4-level serial columns for the warehouses master. Additive + idempotent.
alter table warehouses add column if not exists super_admin_serial text;
alter table warehouses add column if not exists country_serial text;
alter table warehouses add column if not exists branch_serial text;
alter table warehouses add column if not exists entry_serial text;
notify pgrst, 'reload schema';
