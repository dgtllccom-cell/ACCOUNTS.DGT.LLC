import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

import { getDbUrl } from "../lib/db/local-postgres.ts";

let databaseUrl = getDbUrl();

async function main() {
  console.log("Connecting to PostgreSQL at:", databaseUrl.replace(/:[^:@]+@/, ":***@"));
  const sql = postgres(databaseUrl, { ssl: "require", max: 1 });
  try {
    const migrationPath = path.join(process.cwd(), "supabase/migrations/20261118_priority_branch_hierarchy_and_account_categories.sql");
    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    console.log("Applying migration 20261118_priority_branch_hierarchy_and_account_categories.sql...");
    await sql.unsafe(migrationSql);
    console.log("Migration applied successfully!");

    // Verify account_categories count
    const rows = await sql`SELECT count(*)::int as count FROM public.account_categories`;
    console.log("Account categories seeded count:", rows[0]?.count);

    // Verify country_branches columns
    const cols = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'country_branches' AND column_name IN ('operational_domain', 'parent_country_branch_id')
    `;
    console.log("country_branches new columns:", cols.map(c => c.column_name));

    // Verify city_branches operational_domain
    const cityCols = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'city_branches' AND column_name = 'operational_domain'
    `;
    console.log("city_branches new columns:", cityCols.map(c => c.column_name));

    // Verify enterprise_accounts new columns
    const eaCols = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'enterprise_accounts' AND column_name IN ('operational_domain', 'category', 'category_id')
    `;
    console.log("enterprise_accounts new columns:", eaCols.map(c => c.column_name));
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
