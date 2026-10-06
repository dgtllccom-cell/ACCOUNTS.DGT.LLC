import { resolveDbUrl } from "./lib/prod-db-url.mjs";
import postgres from 'postgres';

const sql = postgres(resolveDbUrl("prod"), {
  ssl: { rejectUnauthorized: false },
  prepare: false
});

async function runProfileMigration() {
  console.log("Running additive migration for public.profiles (Employee ↔ User permanent link)...");
  
  await sql`
    ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS person_master_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS middle_name TEXT,
    ADD COLUMN IF NOT EXISTS last_name TEXT,
    ADD COLUMN IF NOT EXISTS photo_url TEXT;
  `;

  console.log("✅ Successfully added employee_id, person_master_id, first_name, middle_name, last_name, photo_url to profiles.");

  const cols = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'profiles'
  `;
  console.log("Updated Profiles Columns:", cols.map(c => c.column_name));

  await sql.end();
}

runProfileMigration().catch(console.error);
