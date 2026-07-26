import { NextResponse } from "next/server";
import postgres from "postgres";

import { requireErpSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseProjectId() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error("DATABASE_URL is not configured");
    }

    const sql = postgres(dbUrl, {
      prepare: false,
      idle_timeout: 5,
      connect_timeout: 10,
      ssl: "require",
    });

    try {
      const tables = await sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `;
      const usersCount = await sql`SELECT count(*)::int AS count FROM users`.catch(() => [{ count: 0 }]);
      const accountsCount = await sql`SELECT count(*)::int AS count FROM accounts`.catch(() => [{ count: 0 }]);
      const roznamchaCount = await sql`SELECT count(*)::int AS count FROM roznamcha_entries`.catch(() => [{ count: 0 }]);
      const ordersCount = await sql`SELECT count(*)::int AS count FROM purchase_orders`.catch(() => [{ count: 0 }]);

      return NextResponse.json({
        ok: true,
        status: "SUCCESSFULLY_CONNECTED",
        supabaseProjectId: getSupabaseProjectId(),
        tableCount: tables.length,
        recordCounts: {
          users: usersCount[0]?.count ?? 0,
          accounts: accountsCount[0]?.count ?? 0,
          roznamchaEntries: roznamchaCount[0]?.count ?? 0,
          purchaseOrders: ordersCount[0]?.count ?? 0,
        },
      });
    } finally {
      await sql.end();
    }
  } catch (error: unknown) {
    const status =
      typeof error === "object" && error !== null && "status" in error && error.status === 401
        ? 401
        : 500;
    return NextResponse.json(
      {
        ok: false,
        status: "CONNECTION_FAILED",
        error: error instanceof Error ? error.message : "Database inspection failed",
      },
      { status },
    );
  }
}
