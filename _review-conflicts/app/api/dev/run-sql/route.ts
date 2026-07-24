import { NextResponse } from "next/server";
import postgres from "postgres";

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    const directUrl = process.env.DATABASE_URL!.replace(":6543", ":5432");
    const sql = postgres(directUrl);
    const result = await sql.unsafe(query);
    await sql.end();
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
