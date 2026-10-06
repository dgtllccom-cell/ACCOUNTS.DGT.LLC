import fs from "node:fs";
import postgres from "postgres";

function loadEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
    }
  } catch (e) {}
  return env;
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 30 });

async function setupLocalSchema() {
  console.log("=======================================================================");
  console.log("  SETTING UP LOCAL POSTGRESQL MULTILINGUAL SCHEMA & TABLES");
  console.log("  Database:", env.DATABASE_URL.replace(/:([^:@]+)@/, ":****@"));
  console.log("=======================================================================\n");

  // 1. Create auth schema & auth.uid() compatibility helper for local Postgres
  console.log("▶ 1. Initializing auth schema & local compatibility helpers...");
  await sql.unsafe(`
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid as $$ select null::uuid; $$ language sql;
  `);

  // 2. Create Enum type translation_source
  console.log("▶ 2. Creating enum type translation_source...");
  await sql.unsafe(`
    do $$ begin
      if not exists (select 1 from pg_type where typname = 'translation_source') then
        create type public.translation_source as enum ('auto', 'manual', 'imported');
      end if;
    end $$;
  `);
  console.log("  ✅ Enum translation_source created.");

  // 3. Create tables & migration tracking
  console.log("\n▶ 3. Creating core application tables & migration tracker...");
  await sql.unsafe(`
    create table if not exists erp_schema_migrations (
      name text primary key, 
      status text not null, 
      applied_at timestamptz not null default now()
    );

    create table if not exists public.profiles (
      id uuid primary key default gen_random_uuid(),
      full_name text,
      email text,
      role text default 'admin',
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    create table if not exists public.countries (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      iso2 text,
      iso3 text,
      currency_code text default 'USD',
      currency_name text,
      default_language_code text default 'en',
      official_email text,
      admin_email text,
      whatsapp_number text,
      phone_code text,
      is_active boolean default true,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      deleted_at timestamptz
    );

    alter table public.countries add column if not exists default_language_code text default 'en';
    alter table public.countries add column if not exists official_email text;
    alter table public.countries add column if not exists admin_email text;
    alter table public.countries add column if not exists whatsapp_number text;

    create table if not exists public.country_branches (
      id uuid primary key default gen_random_uuid(),
      country_id uuid references public.countries(id),
      name text not null,
      code text,
      owner_name text,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      deleted_at timestamptz
    );

    create table if not exists public.city_branches (
      id uuid primary key default gen_random_uuid(),
      country_id uuid references public.countries(id),
      country_branch_id uuid references public.country_branches(id),
      name text not null,
      code text,
      city_name text,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      deleted_at timestamptz
    );

    create table if not exists public.states_provinces (
      id uuid primary key default gen_random_uuid(),
      country_id uuid references public.countries(id),
      name text not null,
      code text,
      is_active boolean default true,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      deleted_at timestamptz
    );

    create table if not exists public.districts (
      id uuid primary key default gen_random_uuid(),
      country_id uuid references public.countries(id),
      state_id uuid references public.states_provinces(id),
      state_province_id uuid references public.states_provinces(id),
      name text not null,
      code text,
      is_active boolean default true,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      deleted_at timestamptz
    );

    create table if not exists public.cities (
      id uuid primary key default gen_random_uuid(),
      country_id uuid references public.countries(id),
      state_id uuid references public.states_provinces(id),
      state_province_id uuid references public.states_provinces(id),
      district_id uuid references public.districts(id),
      name text not null,
      code text,
      is_active boolean default true,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      deleted_at timestamptz
    );

    create table if not exists public.areas_locations (
      id uuid primary key default gen_random_uuid(),
      country_id uuid references public.countries(id),
      state_province_id uuid references public.states_provinces(id),
      district_id uuid references public.districts(id),
      city_id uuid references public.cities(id),
      name text not null,
      code text,
      is_active boolean default true,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      deleted_at timestamptz
    );

    alter table public.states_provinces add column if not exists deleted_at timestamptz;
    alter table public.districts add column if not exists deleted_at timestamptz;
    alter table public.districts add column if not exists state_province_id uuid references public.states_provinces(id);
    alter table public.cities add column if not exists deleted_at timestamptz;
    alter table public.cities add column if not exists state_province_id uuid references public.states_provinces(id);
    alter table public.areas_locations add column if not exists deleted_at timestamptz;
    alter table public.areas_locations add column if not exists state_province_id uuid references public.states_provinces(id);
    alter table public.accounts add column if not exists deleted_at timestamptz;
    alter table public.enterprise_accounts add column if not exists deleted_at timestamptz;
    alter table public.ledgers add column if not exists deleted_at timestamptz;

    create table if not exists public.companies (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      legal_name text,
      country_name text,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      deleted_at timestamptz
    );

    create table if not exists public.accounts (
      id uuid primary key default gen_random_uuid(),
      code text,
      name text,
      account_type text,
      currency_code text default 'USD',
      is_active boolean default true,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    create table if not exists public.enterprise_accounts (
      id uuid primary key default gen_random_uuid(),
      code text,
      name text,
      kind text,
      currency text default 'USD',
      status text default 'active',
      scope text default 'super_admin',
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    create table if not exists public.ledgers (
      id uuid primary key default gen_random_uuid(),
      code text,
      name text,
      debit_total numeric default 0,
      credit_total numeric default 0,
      current_balance numeric default 0,
      created_at timestamptz default now(),
      updated_at timestamptz default now()
    );

    create table if not exists public.purchase_orders (
      id uuid primary key default gen_random_uuid(),
      purchase_order_no text,
      purchase_contract_no text,
      country_id uuid,
      country_branch_id uuid,
      city_branch_id uuid,
      supplier_company_id uuid,
      currency_code text default 'USD',
      exchange_rate numeric default 1,
      order_total numeric default 0,
      advance_paid numeric default 0,
      remaining_due numeric default 0,
      payment_status text default 'pending',
      ledger_posting_status text default 'draft',
      form_data jsonb default '{}'::jsonb,
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      deleted_at timestamptz
    );

    create table if not exists public.sales_orders (
      id uuid primary key default gen_random_uuid(),
      sales_order_no text,
      customer_name text,
      total_amount numeric default 0,
      currency text default 'USD',
      status text default 'Confirmed',
      created_at timestamptz default now(),
      updated_at timestamptz default now(),
      deleted_at timestamptz
    );
  `);
  console.log("  ✅ Application tables & public.profiles created.");

  // 4. Seed default countries in public.countries
  console.log("\n▶ 4. Seeding default location countries...");
  await sql.unsafe(`
    insert into public.countries (name, iso2, iso3, currency_code)
    values
      ('United Arab Emirates', 'AE', 'ARE', 'AED'),
      ('Pakistan', 'PK', 'PAK', 'PKR'),
      ('Afghanistan', 'AF', 'AFG', 'AFN'),
      ('India', 'IN', 'IND', 'INR'),
      ('Iran', 'IR', 'IRN', 'IRR')
    on conflict do nothing;
  `);
  console.log("  ✅ Default countries seeded.");

  // 5. Apply 5-language dedicated tables migration file
  console.log("\n▶ 5. Applying 5-language per-table migration (20260814_per_language_tables.sql)...");
  const migrationPath = "supabase/migrations/20260814_per_language_tables.sql";
  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  await sql.unsafe(migrationSql);
  console.log("  ✅ 5 Per-language tables and upsert_record_translation() RPC created successfully!");

  console.log("\n=======================================================================");
  console.log("  🎉 LOCAL POSTGRESQL SCHEMA SETUP COMPLETE!");
  console.log("  Now run: node scripts/seed-all-tables-with-5-languages.mjs");
  console.log("=======================================================================");

  await sql.end();
}

setupLocalSchema().catch((err) => {
  console.error("Local schema setup error:", err);
  process.exit(1);
});
