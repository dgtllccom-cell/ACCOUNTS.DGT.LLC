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

async function fixColumn() {
  console.log("=======================================================================");
  console.log("  ADDING MISSING state_province_id & deleted_at COLUMNS TO LOCAL DB");
  console.log("  Database:", env.DATABASE_URL.replace(/:([^:@]+)@/, ":****@"));
  console.log("=======================================================================\n");

  await sql.unsafe(`
    alter table public.districts add column if not exists state_province_id uuid;
    alter table public.cities add column if not exists state_province_id uuid;
    alter table public.areas_locations add column if not exists state_province_id uuid;
    
    alter table public.states_provinces add column if not exists deleted_at timestamptz;
    alter table public.districts add column if not exists deleted_at timestamptz;
    alter table public.cities add column if not exists deleted_at timestamptz;
    alter table public.areas_locations add column if not exists deleted_at timestamptz;
    
    alter table public.accounts add column if not exists deleted_at timestamptz;
    alter table public.enterprise_accounts add column if not exists deleted_at timestamptz;
    alter table public.ledgers add column if not exists deleted_at timestamptz;
  `);

  console.log("  ✅ COLUMNS ADDED SUCCESSFULLY TO LOCAL POSTGRESQL!");
  console.log("=======================================================================");

  await sql.end();
}

fixColumn().catch((err) => {
  console.error("Fix error:", err);
  process.exit(1);
});
