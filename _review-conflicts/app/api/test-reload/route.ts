import { NextResponse } from "next/server";
import postgres from "postgres";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ error: "Missing DATABASE_URL" }, { status: 500 });
  }

  const sql = postgres(dbUrl);
  try {
    await sql`NOTIFY pgrst, 'reload schema'`;
    return NextResponse.json({ success: true, message: "Schema reloaded successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    await sql.end();
  }
}
