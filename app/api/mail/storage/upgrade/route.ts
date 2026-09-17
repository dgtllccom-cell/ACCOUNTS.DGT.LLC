import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { updateStalwartQuota } from "@/lib/public-mail/stalwart-client";

function getDb() {
  const url = process.env.DATABASE_URL || "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
  return postgres(url, { max: 1, prepare: false, connect_timeout: 10 });
}

export async function POST(req: NextRequest) {
  const userId = req.cookies.get("dgt_mail_user_id")?.value;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { planId } = await req.json();
    if (!planId) return NextResponse.json({ error: "Plan ID is required" }, { status: 400 });

    const sql = getDb();
    try {
      const [plan] = await sql`
        SELECT * FROM public.public_mail_plans WHERE id = ${planId} LIMIT 1
      `;
      if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

      const [user] = await sql`
        SELECT username, used_bytes FROM public.public_mail_users WHERE id = ${userId} LIMIT 1
      `;
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

      const newQuota = Number(plan.storage_bytes);
      const usedBytes = Number(user.used_bytes || 0);
      let warningLevel = 0;
      if (usedBytes >= newQuota * 0.95) warningLevel = 3;
      else if (usedBytes >= newQuota * 0.8) warningLevel = 1;

      await sql`
        UPDATE public.public_mail_users
        SET 
          plan_id = ${planId},
          quota_bytes = ${newQuota},
          storage_warning_level = ${warningLevel},
          updated_at = NOW()
        WHERE id = ${userId}
      `;

      // Log audit
      await sql`
        INSERT INTO public.public_mail_audit_logs (user_id, action, details)
        VALUES (${userId}, 'upgrade_plan', ${JSON.stringify({ planId, newQuota })})
      `;

      // Sync with Stalwart
      await updateStalwartQuota(user.username, newQuota);

      return NextResponse.json({
        success: true,
        planId,
        quotaBytes: newQuota,
        warningLevel,
      });
    } finally {
      await sql.end();
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
