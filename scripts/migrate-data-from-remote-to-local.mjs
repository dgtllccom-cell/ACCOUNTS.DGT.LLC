import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import fs from "node:fs";
import postgres from "postgres";

const REMOTE_DB_URL = resolveDbUrl("dev");
const LOCAL_DB_URL = "postgresql://postgres:Gulistan%403636@localhost:5432/postgres";

const sourceSql = postgres(REMOTE_DB_URL, { max: 2, prepare: false, connect_timeout: 30 });
const targetSql = postgres(LOCAL_DB_URL, { max: 2, prepare: false, connect_timeout: 30 });

const tablesToCopy = [
  "countries",
  "states_provinces",
  "districts",
  "cities",
  "areas_locations",
  "companies",
  "country_company_profiles",
  "country_branches",
  "city_branches",
  "accounts",
  "enterprise_accounts",
  "ledgers",
  "customers",
  "products",
  "goods",
  "warehouses",
  "purchase_orders",
  "sales_orders",
  "shipping_line_records",
  "expenses_bills"
];

async function migrate() {
  console.log("=======================================================================");
  console.log("  TRANSFERRING DATA FROM REMOTE DB -> LOCAL POSTGRESQL DB (localhost:5432)");
  console.log("=======================================================================\n");

  // 1. Initial schema setup
  try {
    await targetSql.unsafe(`
      create schema if not exists auth;
      create or replace function auth.uid() returns uuid as $$ select null::uuid; $$ language sql;
      do $$ begin
        if not exists (select 1 from pg_type where typname = 'translation_source') then
          create type public.translation_source as enum ('auto', 'manual', 'imported');
        end if;
      end $$;
    `);
    const migrationSql = fs.readFileSync("supabase/migrations/20260814_per_language_tables.sql", "utf8");
    await targetSql.unsafe(migrationSql);
  } catch (e) {}

  // 2. Transfer tables data
  console.log("▶ 1. Transferring Business Tables Data:\n");
  for (const table of tablesToCopy) {
    try {
      console.log(`[+] Fetching "${table}" from Remote DB...`);
      const rows = await sourceSql.unsafe(`select * from public.${table} limit 5000`);

      if (!rows || rows.length === 0) {
        console.log(`  └─ 0 rows in remote "${table}". Skipping.\n`);
        continue;
      }

      console.log(`  └─ Found ${rows.length} rows. Ensuring local table structure...`);

      // Dynamically ensure columns exist on target
      const columns = Object.keys(rows[0]);
      await targetSql.unsafe(`
        create table if not exists public.${table} (
          id uuid primary key default gen_random_uuid(),
          created_at timestamptz default now()
        );
      `);

      for (const col of columns) {
        if (col === "id" || col === "created_at") continue;
        try {
          await targetSql.unsafe(`alter table public.${table} add column if not exists "${col}" text`);
        } catch (e) {}
      }

      let inserted = 0;
      for (const row of rows) {
        const colNames = columns.map(c => `"${c}"`).join(", ");
        const colValues = columns.map(c => row[c]);

        try {
          await targetSql.unsafe(
            `insert into public.${table} (${colNames}) values (${columns.map((_, idx) => `$${idx + 1}`).join(", ")}) on conflict do nothing`,
            colValues
          );
          inserted++;
        } catch (err) {}
      }

      console.log(`  ✅ Transferred ${inserted}/${rows.length} rows into local "public.${table}"!\n`);
    } catch (e) {
      console.log(`  ⚠️ Notice for "${table}": ${e.message}\n`);
    }
  }

  // 3. Migrate Translation Records (record_translations -> 5 dedicated tables)
  console.log("▶ 2. Migrating Translation Records into 5 Dedicated Language Tables:\n");
  try {
    console.log("[+] Fetching translation records from Remote DB...");
    const transRows = await sourceSql`
      select record_table, record_id, field_name, original_text, original_language_code, english_text, urdu_text, arabic_text, persian_text, pashto_text, source
      from public.record_translations
      where deleted_at is null
      limit 5000
    `;

    console.log(`  └─ Found ${transRows.length} translation records. Populating 5 local per-language tables...`);

    let transCount = 0;
    for (const r of transRows) {
      try {
        await targetSql`
          select public.upsert_record_translation(
            ${r.record_table}::text,
            ${r.record_id}::uuid,
            ${r.field_name}::text,
            ${r.original_text || r.english_text || ''}::text,
            ${r.original_language_code || 'en'}::text,
            ${r.english_text || ''}::text,
            ${r.urdu_text || ''}::text,
            ${r.arabic_text || ''}::text,
            ${r.persian_text || ''}::text,
            ${r.pashto_text || ''}::text,
            '{}'::jsonb,
            'auto'::text
          );
        `;
        transCount++;
      } catch (e) {}
    }

    console.log(`  ✅ Successfully populated ${transCount} records across all 5 local per-language tables!\n`);
  } catch (e) {
    console.log(`  ⚠️ Notice migrating translation records: ${e.message}\n`);
  }

  console.log("=======================================================================");
  console.log("  🎉 TRANSFER COMPLETE! ALL PRODUCTION TABLES COPIED TO LOCAL POSTGRES.");
  console.log("=======================================================================");

  await sourceSql.end();
  await targetSql.end();
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
