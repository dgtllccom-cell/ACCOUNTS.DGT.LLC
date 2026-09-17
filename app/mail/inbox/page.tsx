import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import postgres from "postgres";
import { MailClient } from "@/features/public-mail/components/mail-client";

export const metadata = {
  title: "Inbox — DGT Mail",
};

function getDb() {
  const url = process.env.DATABASE_URL || "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
  return postgres(url, { max: 1, prepare: false, connect_timeout: 10 });
}

export default async function DgtMailInboxPage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("dgt_mail_user_id")?.value;

  if (!userId) {
    redirect("/mail/login");
  }

  const sql = getDb();
  let user;
  try {
    const rows = await sql`
      SELECT 
        u.id, u.username, u.domain, u.email_address, u.display_name, 
        u.recovery_email, u.phone_number, u.plan_id, u.quota_bytes, 
        u.used_bytes, u.status, u.storage_warning_level, u.created_at, u.last_login_at
      FROM public.public_mail_users u
      WHERE u.id = ${userId}
      LIMIT 1
    `;

    if (rows.length === 0) {
      redirect("/mail/login");
    }

    const raw = rows[0];
    const used = Number(raw.used_bytes || 0);
    const quota = Number(raw.quota_bytes || 1073741824);
    user = {
      ...raw,
      used_bytes: used,
      quota_bytes: quota,
      usage_percent: Math.min(100, Math.round((used / quota) * 100)),
    };
  } finally {
    await sql.end();
  }

  return <MailClient initialUser={user as any} />;
}
