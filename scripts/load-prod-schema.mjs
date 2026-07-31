/**
 * Load the schema-only baseline into the PRODUCTION Supabase database.
 *
 * WHAT IT DOES
 *   Reads supabase/production-schema.sql (generated from the DEV project) and
 *   applies it to the PROD database in a single transaction. Schema only — no data.
 *
 * PREREQUISITES
 *   • Run from a machine with network access to Supabase (your PC or the VPS) —
 *     NOT from the sandbox.
 *   • Set the PROD database URL. Get the password from the Supabase dashboard
 *     (Production project → Settings → Database → reset password if needed).
 *
 * USAGE (PowerShell)
 *   $env:PROD_DATABASE_URL="postgresql://postgres.inmayhrxucimxqhgseqi:<PW>@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres"
 *   node scripts/load-prod-schema.mjs
 *
 * USAGE (bash)
 *   PROD_DATABASE_URL="postgresql://postgres.inmayhrxucimxqhgseqi:<PW>@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres" \
 *     node scripts/load-prod-schema.mjs
 *
 * Safety: refuses to run unless the target URL is the PROD project ref, so you
 * can't accidentally wipe/alter the dev database with it.
 */
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PROD_REF = "inmayhrxucimxqhgseqi";
const url = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

if (!url) {
  console.error("✗ Set PROD_DATABASE_URL to the production Postgres connection string.");
  process.exit(1);
}
if (!url.includes(PROD_REF)) {
  console.error(`✗ Refusing to run: the connection string does not reference the production project (${PROD_REF}).`);
  console.error("  This guard prevents accidentally loading the schema into the dev database.");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, "..", "supabase", "production-schema.sql");
const schemaSql = readFileSync(schemaPath, "utf8");

const sql = postgres(url, { ssl: "require", max: 1, prepare: false });

const run = async () => {
  console.log(`→ Loading schema into production (${PROD_REF})...`);
  try {
    await sql.unsafe("begin;\n" + schemaSql + "\ncommit;");
    const tables = await sql`select count(*)::int as n from information_schema.tables where table_schema='public'`;
    console.log(`✓ Done. public schema now has ${tables[0].n} tables.`);
  } catch (err) {
    console.error("✗ Load failed (transaction rolled back):", err.message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
};

run();
