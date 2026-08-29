import { resolveDbUrl } from "../scripts/lib/prod-db-url.mjs";
import postgres from "postgres";

const PROD_URL = resolveDbUrl("prod");
const sql = postgres(PROD_URL, { ssl: { rejectUnauthorized: false }, max: 1, prepare: false });

try {
  const rows = await sql`
    select scope_type, scope_key, entity_type, prefix, next_value
    from transaction_serial_sequences
    where entity_type in ('roznamcha','purchase','loading','payment','journal','general')
    order by scope_type, scope_key, entity_type, prefix
    limit 80
  `;
  console.log(JSON.stringify(rows, null, 2));

  const branchIds = ["89ce1041-80b0-4928-b7ea-d4a53bd79d15", "ad8c5172-3381-428d-9244-56487da263a9", "adf14819-b4cf-4956-8fa6-51898f09e01f"];
  const branchNames = await sql`
    select 'city_branch' as kind, id, name, code, country_id from city_branches where id = any(${branchIds}::uuid[])
    union all
    select 'country_branch' as kind, id, name, code, country_id from country_branches where id = any(${branchIds}::uuid[])
  `;
  console.log(JSON.stringify(branchNames, null, 2));

  const serialAudit = await sql`
    select
      'country' as scope_type,
      country_id::text as scope_key,
      max((regexp_match(country_transaction_serial_number, '([0-9]+)$'))[1]::bigint) as max_num,
      max(country_transaction_serial_number) as max_serial
    from roznamcha_entries
    where deleted_at is null and country_id in (
      '935dd0b9-8228-43b3-b53d-c06e9ae2882f'::uuid,
      '8366fa0e-dcf6-4acd-8602-2819f103dd63'::uuid
    )
    group by country_id
    union all
    select
      'main_branch' as scope_type,
      country_branch_id::text as scope_key,
      max((regexp_match(main_branch_transaction_serial, '([0-9]+)$'))[1]::bigint) as max_num,
      max(main_branch_transaction_serial) as max_serial
    from roznamcha_entries
    where deleted_at is null and country_branch_id in (
      'ad8c5172-3381-428d-9244-56487da263a9'::uuid,
      'adf14819-b4cf-4956-8fa6-51898f09e01f'::uuid
    )
    group by country_branch_id
    union all
    select
      'branch' as scope_type,
      coalesce(city_branch_id, country_branch_id)::text as scope_key,
      max((regexp_match(branch_transaction_serial_number, '([0-9]+)$'))[1]::bigint) as max_num,
      max(branch_transaction_serial_number) as max_serial
    from roznamcha_entries
    where deleted_at is null and coalesce(city_branch_id, country_branch_id) in (
      '89ce1041-80b0-4928-b7ea-d4a53bd79d15'::uuid,
      'ad8c5172-3381-428d-9244-56487da263a9'::uuid,
      'adf14819-b4cf-4956-8fa6-51898f09e01f'::uuid
    )
    group by coalesce(city_branch_id, country_branch_id)
    union all
    select
      'branch' as scope_type,
      country_branch_id::text as scope_key,
      max((regexp_match(branch_transaction_serial_number, '([0-9]+)$'))[1]::bigint) as max_num,
      max(branch_transaction_serial_number) as max_serial
    from roznamcha_entries
    where deleted_at is null and country_branch_id in (
      'ad8c5172-3381-428d-9244-56487da263a9'::uuid
    )
    group by country_branch_id
    union all
    select
      'city_branch' as scope_type,
      city_branch_id::text as scope_key,
      max((regexp_match(city_branch_transaction_serial, '([0-9]+)$'))[1]::bigint) as max_num,
      max(city_branch_transaction_serial) as max_serial
    from roznamcha_entries
    where deleted_at is null and city_branch_id in ('89ce1041-80b0-4928-b7ea-d4a53bd79d15'::uuid)
    group by city_branch_id
    union all
    select
      'global' as scope_type,
      'global' as scope_key,
      max((regexp_match(super_admin_serial_number, '([0-9]+)$'))[1]::bigint) as max_num,
      max(super_admin_serial_number) as max_serial
    from roznamcha_entries
    where deleted_at is null
    union all
    select
      'module_roznamcha' as scope_type,
      'global' as scope_key,
      max((regexp_match(entry_serial_number, '([0-9]+)$'))[1]::bigint) as max_num,
      max(entry_serial_number) as max_serial
    from roznamcha_entries
    where deleted_at is null
    order by scope_type, scope_key
  `;
  console.log(JSON.stringify(serialAudit, null, 2));
} finally {
  await sql.end({ timeout: 10 });
}
