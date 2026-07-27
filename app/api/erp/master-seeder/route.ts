import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json({ success: false, error: "DATABASE_URL is not defined." }, { status: 200 });
    }

    const sql = postgres(dbUrl, { ssl: "require", prepare: false, max: 1 });
    const countries = await sql`SELECT id, name FROM countries LIMIT 10`;
    await sql.end();

    return NextResponse.json({
      success: true,
      countriesCount: countries.length
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, stack: err.stack }, { status: 200 });
  }
}
