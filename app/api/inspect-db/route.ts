import { NextResponse } from "next/server";
import postgres from "postgres";

export async function GET() {
  try {
    const dbUrl = process.env.DATABASE_URL || "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres";
    const sql = postgres(dbUrl, { prepare: false, idle_timeout: 5, connect_timeout: 10 });
    
    // Query table counts and live records
    const tablesRes = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    const usersCount = await sql`SELECT count(*)::int as c FROM users;`.catch(() => [{ c: 0 }]);
    const accountsCount = await sql`SELECT count(*)::int as c FROM accounts;`.catch(() => [{ c: 0 }]);
    const roznamchaCount = await sql`SELECT count(*)::int as c FROM roznamcha_entries;`.catch(() => [{ c: 0 }]);
    const ordersCount = await sql`SELECT count(*)::int as c FROM purchase_orders;`.catch(() => [{ c: 0 }]);

    const sampleUsers = await sql`SELECT id, user_code, full_name, role FROM users LIMIT 3;`.catch(() => []);
    const sampleAccounts = await sql`SELECT id, account_code, account_name, current_balance FROM accounts LIMIT 3;`.catch(() => []);

    await sql.end();

    return NextResponse.json({
      ok: true,
      status: "SUCCESSFULLY_CONNECTED",
      supabase_project_id: "csesvyxxjivnkkozgopt",
      tables_in_database: tablesRes.map(t => t.table_name),
      live_record_counts: {
        users: usersCount[0]?.c || 0,
        accounts: accountsCount[0]?.c || 0,
        roznamcha_entries: roznamchaCount[0]?.c || 0,
        purchase_orders: ordersCount[0]?.c || 0
      },
      sample_data: {
        users: sampleUsers,
        accounts: sampleAccounts
      }
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      status: "CONNECTION_FAILED",
      error: err.message
    }, { status: 500 });
  }
}
