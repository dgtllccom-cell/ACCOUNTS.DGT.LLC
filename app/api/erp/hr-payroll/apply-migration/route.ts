import { NextResponse } from "next/server";
import postgres from "postgres";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: "DATABASE_URL is not set in env" }, { status: 200 });
  }

  // Create client
  const sql = postgres(dbUrl, { ssl: { rejectUnauthorized: false } });

  try {
    const sqlPath = path.join(process.cwd(), "supabase/migrations/0071_employee_and_salary.sql");
    const sqlContent = fs.readFileSync(sqlPath, "utf8");

    console.log("Applying employee & salary database migration via direct postgres client...");
    await sql.unsafe(sqlContent);

    return NextResponse.json({ success: true, message: "Migration applied successfully" });
  } catch (err: any) {
    console.error("Migration exception:", err);
    return NextResponse.json({ error: err.message }, { status: 200 });
  } finally {
    await sql.end();
  }
}
