import postgres from "postgres";
import fs from "fs";
import path from "path";

// Production Supabase Ref: inmayhrxucimxqhgseqi
const PROD_DB_URL = process.env.PROD_DATABASE_URL;
if (!PROD_DB_URL) {
  console.error("FATAL: PROD_DATABASE_URL is not set.");
  process.exit(1);
}

async function runMigration() {
  console.log("Applying reviewed migration 20261129_public_email_platform.sql to Production DB (inmayhrxucimxqhgseqi)...");
  const migrationPath = path.resolve("supabase/migrations/20261129_public_email_platform.sql");
  const sqlContent = fs.readFileSync(migrationPath, "utf8");

  const sql = postgres(PROD_DB_URL, { max: 1, connect_timeout: 15 });
  try {
    await sql.unsafe(sqlContent);
    console.log("✅ Migration applied successfully to Production!");

    const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name LIKE 'public_mail_%'
      ORDER BY table_name
    `;
    console.log("Verified Production public_mail tables:", tables.map(t => t.table_name));
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
  } finally {
    await sql.end();
  }
}

runMigration();
