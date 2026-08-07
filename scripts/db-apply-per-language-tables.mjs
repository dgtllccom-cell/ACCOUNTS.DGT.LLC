import fs from "node:fs";
import postgres from "postgres";

function parseEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^"|"$/g, "");
  }
  return env;
}

// Match Next.js precedence: .env first, then .env.local overrides.
function loadEnv() {
  return { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const migrationName = "20260814_per_language_tables";
const migrationPath = "supabase/migrations/20260814_per_language_tables.sql";
const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 30 });

try {
  console.log("Project:", env.NEXT_PUBLIC_SUPABASE_URL);
  await sql`create table if not exists erp_schema_migrations (name text primary key, status text not null, applied_at timestamptz not null default now())`;
  const existing = await sql`select name, status from erp_schema_migrations where name = ${migrationName}`;
  if (existing.length && existing[0].status === "applied") {
    console.log(`${migrationName} already applied`);
    process.exit(0);
  }

  const migrationSql = fs.readFileSync(migrationPath, "utf8");
  await sql.unsafe(migrationSql);
  await sql`insert into erp_schema_migrations (name, status) values (${migrationName}, 'applied') on conflict (name) do update set status='applied', applied_at=now()`;

  // Post-apply verification
  const relkind = await sql`select relkind from pg_class where relname='record_translations' and relnamespace='public'::regnamespace`;
  const tables = await sql`
    select c.relname, (select count(*) from pg_class x)::int as _
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname like 'translations_%' order by c.relname`;
  const counts = {};
  for (const t of ["translations_english","translations_urdu","translations_arabic","translations_persian","translations_pashto"]) {
    const r = await sql.unsafe(`select count(*)::int n from public.${t}`);
    counts[t] = r[0].n;
  }
  const viewCount = await sql`select count(*)::int n from public.record_translations`;
  const legacy = await sql`select relname from pg_class where relname='record_translations_legacy' and relnamespace='public'::regnamespace`;

  console.log(JSON.stringify({
    ok: true,
    applied: migrationName,
    record_translations_relkind: relkind[0]?.relkind + " (v=view, r=table)",
    per_language_tables: tables.map(t => t.relname),
    row_counts: counts,
    view_row_count: viewCount[0].n,
    legacy_table_present: legacy.length > 0,
  }, null, 2));
} catch (error) {
  console.error("MIGRATION FAILED:", error.message);
  console.error(error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
