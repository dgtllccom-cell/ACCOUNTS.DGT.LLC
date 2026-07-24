import fs from "node:fs";
import { NextResponse } from "next/server";
import postgres from "postgres";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export async function GET() {
  const envFile = fs.readFileSync(".env.local", "utf8");
  const envLines = envFile.split(/\r?\n/).filter(line => line.includes("=") && !line.trim().startsWith("#"));
  const env = Object.fromEntries(envLines.map(line => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1)];
  }));

  if (!env.DATABASE_URL) {
    return NextResponse.json({ error: "No DATABASE_URL" }, { status: 500 });
  }
  const directUrl = env.DATABASE_URL.replace(":6543", ":5432");

  const sql = postgres(directUrl, {
    max: 1,
    prepare: false,
    connect_timeout: 15
  });

  const results = [];
  try {
    const directUrl = process.env.DATABASE_URL!.replace(":6543", ":5432");
    const sql = require("postgres")(directUrl);
    
    await sql.unsafe(`
      ALTER TABLE expenses_bills 
      ADD COLUMN IF NOT EXISTS debit_ledger_id UUID REFERENCES ledgers(id),
      ADD COLUMN IF NOT EXISTS credit_ledger_id UUID REFERENCES ledgers(id);
    `);
    
    // Refresh schema cache
    await sql.unsafe(`NOTIFY pgrst, 'reload schema'`);
    
    await sql.end();
    results.push({ success: true, message: "Columns added and schema refreshed" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || String(error) }, { status: 200 });
  } finally {
    await sql.end();
  }

  return NextResponse.json({ success: true, results });
}
