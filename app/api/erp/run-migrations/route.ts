import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import postgres from "postgres";

export async function GET() {
  console.log("Migration API triggered...");
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    return NextResponse.json({ success: false, error: "DATABASE_URL env var not found" });
  }

  const directUrl = rawUrl.replace(":6543", ":5432");
  const sql = postgres(directUrl);

  try {
    const migDir = path.join(process.cwd(), "supabase", "migrations");
    const filesToRun = [
      "0073_entity_serial_counters.sql",
      "0074_fix_recalc_with_loading_proportional.sql",
      "0075_payment_posting_workflow_fixes.sql",
      "0077_daily_usd_rates_audit_columns.sql"
    ];

    const results = [];
    for (const file of filesToRun) {
      console.log(`Running migration: ${file}`);
      const filePath = path.join(migDir, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Migration file not found: ${file}`);
      }
      const content = fs.readFileSync(filePath, "utf8");
      await sql.unsafe(content);
      results.push({ file, status: "success" });
    }

    return NextResponse.json({
      success: true,
      message: "Migrations applied successfully!",
      results
    });
  } catch (err: any) {
    console.error("Migration error:", err);
    return NextResponse.json({
      success: false,
      error: err.message || String(err),
      stack: err.stack || ""
    });
  } finally {
    await sql.end();
  }
}
