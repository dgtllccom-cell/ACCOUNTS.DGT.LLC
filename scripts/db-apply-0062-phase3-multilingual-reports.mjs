import fs from "node:fs";
import postgres from "postgres";

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const migrationName = "0062_phase3_multilingual_reports";
const migrationPath = "supabase/migrations/0062_phase3_multilingual_reports.sql";
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 20 });

try {
  await sql`create table if not exists erp_schema_migrations (name text primary key, status text not null, applied_at timestamptz not null default now())`;
  const existing = await sql`select name, status from erp_schema_migrations where name = ${migrationName}`;
  if (existing.length && existing[0].status === "applied") {
    console.log(`${migrationName} already applied`);
    process.exit(0);
  }

  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  await sql.begin(async (tx) => {
    await tx.unsafe(migrationSql);
    await tx`
      insert into erp_schema_migrations (name, status, applied_at)
      values (${migrationName}, 'applied', now())
      on conflict (name) do update set status = excluded.status, applied_at = excluded.applied_at
    `;
  });

  const marker = await sql`select name, status, applied_at from erp_schema_migrations where name = ${migrationName}`;
  console.log(JSON.stringify({ ok: true, migration: marker[0] }, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end();
}