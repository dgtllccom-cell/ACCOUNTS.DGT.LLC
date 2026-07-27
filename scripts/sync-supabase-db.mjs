import fs from 'fs';
import path from 'path';
import postgres from 'postgres';

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (fs.existsSync('.env.local')) {
    const lines = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().startsWith('DATABASE_URL=')) {
        return line.slice(line.indexOf('=') + 1).trim();
      }
    }
  }
  throw new Error("DATABASE_URL is not configured in the environment or .env.local");
}

async function syncMigrations() {
  const dbUrl = getDatabaseUrl();
  console.log("===============================================================");
  console.log("  AUTOMATIC SUPABASE DATABASE SYNCHRONIZATION");
  console.log("  Target DB:", dbUrl.replace(/:[^:@]+@/, ':****@'));
  console.log("===============================================================\n");

  const sql = postgres(dbUrl, {
    prepare: false,
    idle_timeout: 10,
    connect_timeout: 30,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // 1. Create a tracking table for applied migrations if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS _applied_schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const appliedRows = await sql`SELECT filename FROM _applied_schema_migrations;`;
    const appliedFiles = new Set(appliedRows.map(r => r.filename));

    // 2. Read migration files from supabase/migrations
    const migDir = path.join(process.cwd(), 'supabase', 'migrations');
    if (!fs.existsSync(migDir)) {
      console.log("No supabase/migrations directory found.");
      return;
    }

    const files = fs.readdirSync(migDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration file(s) in supabase/migrations/`);

    let newAppliedCount = 0;
    for (const file of files) {
      if (appliedFiles.has(file)) {
        continue;
      }

      console.log(`[SYNC] Applying migration: ${file}...`);
      const filePath = path.join(migDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf8');

      if (sqlContent.trim().length > 0) {
        await sql.unsafe(sqlContent);
      }

      await sql`
        INSERT INTO _applied_schema_migrations (filename)
        VALUES (${file})
        ON CONFLICT (filename) DO NOTHING;
      `;
      console.log(`[SYNC] ✅ Successfully applied: ${file}`);
      newAppliedCount++;
    }

    if (newAppliedCount === 0) {
      console.log("✅ All database migrations are fully synchronized with Supabase!");
    } else {
      console.log(`\n🎉 Applied ${newAppliedCount} new migration(s) to Supabase central database!`);
    }

  } catch (err) {
    console.error("❌ Migration Sync Warning/Error:", err.message);
  } finally {
    await sql.end();
  }
}

syncMigrations();
