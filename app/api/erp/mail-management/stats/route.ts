import { NextResponse } from "next/server";
import postgres from "postgres";
import { getStalwartStats } from "@/lib/public-mail/stalwart-client";
import { getErpSessionForApi } from "@/lib/auth/session";

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return postgres(url, { max: 1, prepare: false, connect_timeout: 10 });
}

export async function GET() {
  const session = await getErpSessionForApi();
  if (!session || !session.isSuperAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const sql = getDb();
  try {
    const [userCounts] = await sql`
      SELECT 
        COUNT(*)::int as total_users,
        COUNT(*) FILTER (WHERE status = 'active')::int as active_users,
        COUNT(*) FILTER (WHERE status = 'suspended')::int as suspended_users,
        COALESCE(SUM(used_bytes), 0)::bigint as total_used_bytes,
        COALESCE(SUM(quota_bytes), 0)::bigint as total_quota_bytes,
        COUNT(*) FILTER (WHERE storage_warning_level > 0)::int as quota_warnings_count
      FROM public.public_mail_users
    `;

    const [messagesCount] = await sql`
      SELECT COUNT(*)::int as total_messages FROM public.public_mail_messages
    `;

    const stalwart = await getStalwartStats();

    return NextResponse.json({
      overview: {
        totalUsers: userCounts.total_users || 0,
        activeUsers: userCounts.active_users || 0,
        suspendedUsers: userCounts.suspended_users || 0,
        totalUsedBytes: Number(userCounts.total_used_bytes || 0),
        totalQuotaBytes: Number(userCounts.total_quota_bytes || 0),
        quotaWarningsCount: userCounts.quota_warnings_count || 0,
        totalMessages: messagesCount.total_messages || 0,
      },
      server: {
        ...stalwart,
        hostname: "mail.dgt.llc",
        ip: "72.60.209.121",
        ports: {
          smtp: 25,
          smtps: 465,
          submission: 587,
          imaps: 993,
        },
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await sql.end();
  }
}
