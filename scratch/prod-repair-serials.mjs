import postgres from "postgres";

const PROD_URL = "postgresql://postgres.inmayhrxucimxqhgseqi:9z2_v5b6oZKPrbwoEL-z6awkg53gPDmPf3_pNFbSFsSVQdDk@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres";
const sql = postgres(PROD_URL, { ssl: { rejectUnauthorized: false }, max: 1, prepare: false });

try {
  const before = await sql`
    select scope_type, scope_key, entity_type, prefix, next_value
    from transaction_serial_sequences
    where (scope_type, scope_key, entity_type) in (
      ('global','global','roznamcha'),
      ('module_roznamcha','global','roznamcha'),
      ('country','935dd0b9-8228-43b3-b53d-c06e9ae2882f','roznamcha'),
      ('branch','89ce1041-80b0-4928-b7ea-d4a53bd79d15','roznamcha'),
      ('branch','ad8c5172-3381-428d-9244-56487da263a9','roznamcha'),
      ('main_branch','ad8c5172-3381-428d-9244-56487da263a9','roznamcha'),
      ('city_branch','89ce1041-80b0-4928-b7ea-d4a53bd79d15','roznamcha')
    )
    order by scope_type, scope_key
  `;
  console.log("BEFORE");
  console.log(JSON.stringify(before, null, 2));

  await sql`
    with computed as (
      select 'global'::text as scope_type, 'global'::text as scope_key, 'roznamcha'::text as entity_type, 'SA'::text as prefix, coalesce(max((regexp_match(super_admin_serial_number, '([0-9]+)$'))[1]::bigint), 0) + 1 as next_value
      from roznamcha_entries
      where deleted_at is null
      union all
      select 'module_roznamcha'::text, 'global'::text, 'roznamcha'::text, 'ROZ'::text, coalesce(max((regexp_match(entry_serial_number, '([0-9]+)$'))[1]::bigint), 0) + 1
      from roznamcha_entries
      where deleted_at is null
      union all
      select 'country'::text, '935dd0b9-8228-43b3-b53d-c06e9ae2882f'::text, 'roznamcha'::text, 'UAE'::text, coalesce(max((regexp_match(country_transaction_serial_number, '([0-9]+)$'))[1]::bigint), 0) + 1
      from roznamcha_entries
      where deleted_at is null and country_id = '935dd0b9-8228-43b3-b53d-c06e9ae2882f'::uuid
      union all
      select 'branch'::text, '89ce1041-80b0-4928-b7ea-d4a53bd79d15'::text, 'roznamcha'::text, 'AL'::text, coalesce(max((regexp_match(branch_transaction_serial_number, '([0-9]+)$'))[1]::bigint), 0) + 1
      from roznamcha_entries
      where deleted_at is null and city_branch_id = '89ce1041-80b0-4928-b7ea-d4a53bd79d15'::uuid
      union all
      select 'branch'::text, 'ad8c5172-3381-428d-9244-56487da263a9'::text, 'roznamcha'::text, 'MAIN'::text, coalesce(max((regexp_match(branch_transaction_serial_number, '([0-9]+)$'))[1]::bigint), 0) + 1
      from roznamcha_entries
      where deleted_at is null and country_branch_id = 'ad8c5172-3381-428d-9244-56487da263a9'::uuid
      union all
      select 'main_branch'::text, 'ad8c5172-3381-428d-9244-56487da263a9'::text, 'roznamcha'::text, 'MAIN'::text, coalesce(max((regexp_match(main_branch_transaction_serial, '([0-9]+)$'))[1]::bigint), 0) + 1
      from roznamcha_entries
      where deleted_at is null and country_branch_id = 'ad8c5172-3381-428d-9244-56487da263a9'::uuid
      union all
      select 'city_branch'::text, '89ce1041-80b0-4928-b7ea-d4a53bd79d15'::text, 'roznamcha'::text, 'AL'::text, coalesce(max((regexp_match(city_branch_transaction_serial, '([0-9]+)$'))[1]::bigint), 0) + 1
      from roznamcha_entries
      where deleted_at is null and city_branch_id = '89ce1041-80b0-4928-b7ea-d4a53bd79d15'::uuid
    )
    insert into transaction_serial_sequences (scope_type, scope_key, entity_type, prefix, next_value)
    select scope_type, scope_key, entity_type, prefix, next_value
    from computed
    on conflict (scope_type, scope_key, entity_type)
    do update set
      prefix = excluded.prefix,
      next_value = greatest(transaction_serial_sequences.next_value, excluded.next_value),
      updated_at = now();
  `;

  const after = await sql`
    select scope_type, scope_key, entity_type, prefix, next_value
    from transaction_serial_sequences
    where (scope_type, scope_key, entity_type) in (
      ('global','global','roznamcha'),
      ('module_roznamcha','global','roznamcha'),
      ('country','935dd0b9-8228-43b3-b53d-c06e9ae2882f','roznamcha'),
      ('branch','89ce1041-80b0-4928-b7ea-d4a53bd79d15','roznamcha'),
      ('branch','ad8c5172-3381-428d-9244-56487da263a9','roznamcha'),
      ('main_branch','ad8c5172-3381-428d-9244-56487da263a9','roznamcha'),
      ('city_branch','89ce1041-80b0-4928-b7ea-d4a53bd79d15','roznamcha')
    )
    order by scope_type, scope_key
  `;
  console.log("AFTER");
  console.log(JSON.stringify(after, null, 2));
} finally {
  await sql.end({ timeout: 10 });
}
