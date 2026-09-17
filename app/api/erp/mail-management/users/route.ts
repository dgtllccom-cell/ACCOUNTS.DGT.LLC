import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";

function getDb() {
  const url = process.env.DATABASE_URL || "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
  return postgres(url, { max: 2, prepare: false, connect_timeout: 10 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "all";

  const sql = getDb();
  try {
    let query = sql`
      SELECT 
        u.id, u.username, u.domain, u.email_address, u.display_name, 
        u.recovery_email, u.phone_number, u.plan_id, u.quota_bytes, 
        u.used_bytes, u.status, u.storage_warning_level, u.created_at, u.last_login_at,
        p.name as plan_name
      FROM public.public_mail_users u
      LEFT JOIN public.public_mail_plans p ON u.plan_id = p.id
      WHERE 1=1
    `;

    const rows = await sql`
      SELECT 
        u.id, u.username, u.domain, u.email_address, u.display_name, 
        u.recovery_email, u.phone_number, u.plan_id, u.quota_bytes, 
        u.used_bytes, u.status, u.storage_warning_level, u.created_at, u.last_login_at,
        p.name as plan_name
      FROM public.public_mail_users u
      LEFT JOIN public.public_mail_plans p ON u.plan_id = p.id
      ORDER BY u.created_at DESC
      LIMIT 200
    `;

    let filtered = rows;
    if (status !== "all") {
      filtered = filtered.filter((r) => r.status === status);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.username.toLowerCase().includes(q) ||
          r.display_name.toLowerCase().includes(q) ||
          r.email_address.toLowerCase().includes(q)
      );
    }

    const formatted = filtered.map((u) => {
      const used = Number(u.used_bytes || 0);
      const quota = Number(u.quota_bytes || 1073741824);
      return {
        ...u,
        used_bytes: used,
        quota_bytes: quota,
        usage_percent: Math.min(100, Math.round((used / quota) * 100)),
      };
    });

    return NextResponse.json({ users: formatted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await sql.end();
  }
}
