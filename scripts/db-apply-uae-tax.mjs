import fs from "node:fs";
import postgres from "postgres";

/**
 * Applies the UAE Tax / VAT / e-Invoicing migrations in order.
 * Each file is idempotent (IF NOT EXISTS / ON CONFLICT) so re-running is safe.
 *
 *   node scripts/db-apply-uae-tax.mjs
 */

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

const env = { ...parseEnvFile(".env"), ...parseEnvFile(".env.local") };
if (!env.DATABASE_URL) {
  console.error("DATABASE_URL is not set (.env / .env.local)");
  process.exit(1);
}

const MIGRATIONS = [
  "supabase/migrations/20260901_uae_tax_einvoicing_foundation.sql",
  // Phase 2+: "supabase/migrations/20260902_uae_tax_ingestion.sql", ...
];

const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false, connect_timeout: 60 });

async function main() {
  for (const file of MIGRATIONS) {
    if (!fs.existsSync(file)) {
      console.log(`skip (not found yet): ${file}`);
      continue;
    }
    console.log(`Applying ${file} ...`);
    await sql.unsafe(fs.readFileSync(file, "utf8"));
    console.log("  ok");
  }

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name LIKE 'uae_%'
    ORDER BY table_name
  `;
  console.log("uae_* tables:", tables.map((r) => r.table_name));

  const views = await sql`
    SELECT table_name FROM information_schema.views
    WHERE table_schema = 'public' AND table_name LIKE 'uae_%'
    ORDER BY table_name
  `;
  console.log("uae_* views:", views.map((r) => r.table_name));

  const fns = await sql`
    SELECT routine_name FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND (routine_name LIKE 'uae_%' OR routine_name LIKE 'get_uae_%' OR routine_name LIKE 'sync_uae_%')
    ORDER BY routine_name
  `;
  console.log("uae_* functions:", fns.map((r) => r.routine_name));

  const applied = await sql`
    SELECT name, status, applied_at FROM public.erp_schema_migrations
    WHERE name LIKE '20260901_uae_%' OR name LIKE '2026090%_uae_%'
    ORDER BY name
  `;
  console.log("erp_schema_migrations:", applied);

  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
