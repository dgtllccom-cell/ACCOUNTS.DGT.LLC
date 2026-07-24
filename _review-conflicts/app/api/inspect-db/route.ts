import { NextResponse } from "next/server";
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
    }

    const sql = postgres(databaseUrl, { max: 1, prepare: false });

    // 1. Create tracking table if not exists
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS public.local_applied_migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE,
        applied_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. Fetch already applied migrations
    const appliedRows = await sql`
      SELECT filename FROM public.local_applied_migrations
    `;
    const appliedSet = new Set(appliedRows.map(r => r.filename));

    // 3. Scan migrations directory
    const migrationsDir = path.join(process.cwd(), "supabase/migrations");
    const migrationFiles = fs.existsSync(migrationsDir)
      ? fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql"))
      : [];

    // Sort files chronologically/alphabetically
    migrationFiles.sort();

    const results: Array<{ filename: string; status: string; error?: string }> = [];

    // 4. Apply pending migrations in order
    for (const file of migrationFiles) {
      // Parse migration number (e.g. "0043" from "0043_purchase_booking_transfer_with_actor.sql")
      const fileNumber = parseInt(file.split("_")[0] || "0", 10);

      // Migrations < 43 are base migrations already present in the initial DB schema.
      // We automatically mark them as applied to prevent re-running them.
      if (fileNumber < 43) {
        if (!appliedSet.has(file)) {
          await sql`
            INSERT INTO public.local_applied_migrations (filename)
            VALUES (${file})
            ON CONFLICT (filename) DO NOTHING
          `;
        }
        results.push({ filename: file, status: "skipped_base_migration" });
        continue;
      }

      if (appliedSet.has(file)) {
        results.push({ filename: file, status: "already_applied" });
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const migrationSql = fs.readFileSync(filePath, "utf8");

      try {
        // Execute the migration SQL
        await sql.unsafe(migrationSql);

        // Record successful migration
        await sql`
          INSERT INTO public.local_applied_migrations (filename)
          VALUES (${file})
        `;

        results.push({ filename: file, status: "success" });
      } catch (err: any) {
        results.push({ filename: file, status: "failed", error: err.message });
        // Halt migration execution on first failure
        break;
      }
    }

    // 5. Verify the function was created
    const funcs = await sql`
      SELECT proname, pg_get_function_arguments(oid) as args
      FROM pg_proc 
      WHERE proname = 'post_purchase_booking_transfer'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `;

    await sql.end();
    return NextResponse.json({
      success: true,
      migrations: results,
      functions: funcs
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}
