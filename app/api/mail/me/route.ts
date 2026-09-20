import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { resolveSessionUserId } from "@/lib/public-mail/webmail-service";

function getDb() {
  const url = process.env.DATABASE_URL || "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
  return postgres(url, { max: 1, prepare: false, connect_timeout: 10 });
}

export async function GET(req: NextRequest) {
  const userId = await resolveSessionUserId(req.cookies.get("dgt_mail_user_id")?.value);
  if (!userId) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  const sql = getDb();
  try {
    const rows = await sql`
      SELECT 
        u.id, u.username, u.domain, u.email_address, u.display_name, 
        u.recovery_email, u.phone_number, u.plan_id, u.quota_bytes, 
        u.used_bytes, u.status, u.storage_warning_level, u.created_at,
        p.name as plan_name, p.monthly_price_usd, p.max_attachment_bytes
      FROM public.public_mail_users u
      LEFT JOIN public.public_mail_plans p ON u.plan_id = p.id
      WHERE u.id = ${userId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const user = rows[0];
    const usedBytes = Number(user.used_bytes || 0);
    const quotaBytes = Number(user.quota_bytes || 1073741824);
    const usagePercent = Math.min(100, Math.round((usedBytes / quotaBytes) * 100));

    return NextResponse.json({
      authenticated: true,
      user: {
        ...user,
        used_bytes: usedBytes,
        quota_bytes: quotaBytes,
        usage_percent: usagePercent,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await sql.end();
  }
}
