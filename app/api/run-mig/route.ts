import { NextResponse } from "next/server";
import postgres from "postgres";
import fs from "node:fs";

export const dynamic = "force-dynamic";

export async function GET() {
  let sql;
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      fs.writeFileSync("inspect-po.json", JSON.stringify({ error: "DATABASE_URL not configured" }));
      return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
    }

    sql = postgres(databaseUrl, { max: 1, prepare: false });

    const po = await sql`
      SELECT *
      FROM purchase_orders
      WHERE purchase_order_no = 'PK-001-0002'
      AND deleted_at IS NULL
    `;

    fs.writeFileSync("inspect-po.json", JSON.stringify({ po: po[0] || null }, null, 2));

    await sql.end();
    return NextResponse.json({ success: true });
  } catch (err: any) {
    fs.writeFileSync("inspect-po.json", JSON.stringify({ error: err.message, stack: err.stack }, null, 2));
    if (sql) await sql.end();
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
