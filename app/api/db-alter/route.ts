import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

export async function GET(request: NextRequest) {
  try {
    const sql = postgres(process.env.DATABASE_URL!, { ssl: "require", max: 1 });
    const result = await sql.unsafe("ALTER TABLE enterprise_accounts ADD COLUMN IF NOT EXISTS contacts JSONB DEFAULT '[]'::jsonb;");
    await sql.end();
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

