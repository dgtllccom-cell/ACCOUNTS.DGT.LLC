import fs from "node:fs";
import postgres from "postgres";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, {
  max: 1,
  prepare: false,
  connect_timeout: 15
});

const migrationName = "0034_country_user_role_scope";

try {
  await sql`select now()`;
  await sql`
    create table if not exists erp_schema_migrations (
      name text primary key,
      status text not null,
      applied_at timestamptz not null default now()
    )
  `;

  const [existing] = await sql`
    select exists (
      select 1
      from erp_schema_migrations
      where name = ${migrationName}
        and status = 'applied'
    ) as applied
  `;

  if (!existing.applied) {
    await sql`alter type app_role add value if not exists 'country_user'`;
    await sql`alter table user_role_assignments drop constraint if exists user_role_scope_chk`;
    await sql`
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
        )
    `;
    await sql`
      insert into erp_role_templates (code, name, scope_level, description, is_system)
      select
        'country_user',
        'Country User',
        'country',
        'Country-scoped user with read/report access to assigned country data.',
        true
      where not exists (
        select 1 from erp_role_templates where code = 'country_user'
      )
    `;
    await sql`
      insert into erp_schema_migrations (name, status)
      values (${migrationName}, 'applied')
      on conflict (name) do update
        set status = excluded.status,
            applied_at = now()
    `;
    console.log(`${migrationName}: applied`);
  } else {
    console.log(`${migrationName}: already applied`);
  }

  const [enumRow] = await sql`
    select exists (
      select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
      where t.typname = 'app_role'
        and e.enumlabel = 'country_user'
    ) as exists
  `;
  const [constraintRow] = await sql`
    select exists (
      select 1
      from pg_constraint
      where conname = 'user_role_scope_chk'
    ) as exists
  `;
  const [templateRow] = await sql`
    select count(*)::int as count
    from erp_role_templates
    where code = 'country_user'
  `;
  const [markerRow] = await sql`
    select status
    from erp_schema_migrations
    where name = ${migrationName}
  `;

  console.log(
    JSON.stringify(
      {
        appRoleCountryUser: enumRow.exists,
        userRoleScopeConstraint: constraintRow.exists,
        countryUserRoleTemplates: templateRow.count,
        migrationStatus: markerRow?.status ?? null
      },
      null,
      2
    )
  );

  if (!enumRow.exists || !constraintRow.exists || templateRow.count < 1 || markerRow?.status !== "applied") {
    process.exit(1);
  }
} catch (error) {
  console.error("country user role migration failed:");
  console.error(error.message || error);
  process.exit(1);
} finally {
  await sql.end();
}
