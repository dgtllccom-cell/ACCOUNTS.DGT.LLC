import fs from "node:fs";
import postgres from "postgres";

function loadEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

const email = (process.argv[2] || "").trim();
const fullName = (process.argv[3] || "Super Admin").trim();

if (!email) {
  console.error("Usage: node scripts/db-bootstrap-super-admin.mjs <email> [fullName]");
  process.exit(1);
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 15 });

const bootstrapMigrations = [
  {
    name: "0021_branch_permission_grants",
    path: "supabase/migrations/0021_branch_permission_grants.sql"
  },
  {
    name: "0022_multilingual_search_enforcement",
    path: "supabase/migrations/0022_multilingual_search_enforcement.sql"
  },
  {
    name: "0023_product_master_architecture",
    path: "supabase/migrations/0023_product_master_architecture.sql"
  },
  {
    name: "0024_purchase_loading_records",
    path: "supabase/migrations/0024_purchase_loading_records.sql"
  }
];

async function ensureMigrationTable() {
  await sql`
    create table if not exists erp_schema_migrations (
      name text primary key,
      status text not null,
      applied_at timestamptz not null default now()
    )
  `;
}

async function migrationApplied(name) {
  const [row] = await sql`
    select exists (
      select 1
      from erp_schema_migrations
      where name = ${name}
    ) as applied
  `;
  return row.applied;
}

async function applyBootstrapMigrations() {
  await ensureMigrationTable();

  for (const migration of bootstrapMigrations) {
    if (await migrationApplied(migration.name)) {
      console.log(`${migration.name}: already marked applied`);
      continue;
    }

    const sqlText = fs.readFileSync(migration.path, "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(sqlText);
      await tx`
        insert into erp_schema_migrations (name, status)
        values (${migration.name}, 'applied')
        on conflict (name) do update
          set status = excluded.status,
              applied_at = now()
      `;
    });
    console.log(`${migration.name}: applied`);
  }
}

try {
  await applyBootstrapMigrations();

  const [user] = await sql`
    select id, email
    from auth.users
    where lower(email) = lower(${email})
    limit 1
  `;

  if (!user?.id) {
    console.error(`No auth user found for email: ${email}`);
    console.error("Create/sign-up the user in Supabase Auth first, then rerun this script.");
    process.exit(1);
  }

  await sql.begin(async (tx) => {
    // Ensure profile exists (profiles.id references auth.users.id).
    await tx`
      insert into profiles (id, full_name)
      values (${user.id}, ${fullName})
      on conflict (id) do update
        set full_name = excluded.full_name,
            updated_at = now()
    `;

    // Ensure super_admin role assignment exists for this user.
    await tx`
      insert into user_role_assignments (user_id, role, is_active, created_by)
      select ${user.id}, 'super_admin'::app_role, true, ${user.id}
      where not exists (
        select 1
        from user_role_assignments ura
        where ura.user_id = ${user.id}
          and ura.role = 'super_admin'::app_role
          and ura.deleted_at is null
      )
    `;
  });

  console.log(`Super Admin role ensured for: ${email}`);
} catch (error) {
  console.error("Failed to bootstrap super admin:");
  console.error(error?.message || error);
  process.exit(1);
} finally {
  await sql.end();
}
