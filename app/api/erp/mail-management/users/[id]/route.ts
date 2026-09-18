import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { hashPassword } from "@/lib/public-mail/crypto";
import { updateStalwartQuota, setStalwartAccountStatus, deleteStalwartAccount } from "@/lib/public-mail/stalwart-client";

function getDb() {
  const url = process.env.DATABASE_URL || "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
  return postgres(url, { max: 1, prepare: false, connect_timeout: 10 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const sql = getDb();

  try {
    const [user] = await sql`SELECT * FROM public.public_mail_users WHERE id = ${id} LIMIT 1`;
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const updates: Record<string, unknown> = { updated_at: new Date() };

    // Quota change
    if (typeof body.quota_bytes === "number" && body.quota_bytes > 0) {
      updates.quota_bytes = body.quota_bytes;
      await updateStalwartQuota(user.username, body.quota_bytes);
    }

    // Status change
    if (body.status === "active" || body.status === "suspended") {
      updates.status = body.status;
      await setStalwartAccountStatus(user.username, body.status);
    }

    // Password reset
    const newPwd = body.new_password || body.password;
    if (typeof newPwd === "string" && newPwd.length >= 6) {
      updates.password_hash = hashPassword(newPwd);
    }

    const [updated] = await sql`
      UPDATE public.public_mail_users
      SET ${sql(updates)}
      WHERE id = ${id}
      RETURNING id, username, email_address, display_name, quota_bytes, used_bytes, status
    `;

    // Audit log
    await sql`
      INSERT INTO public.public_mail_audit_logs (user_id, action, performed_by, details)
      VALUES (${id}, 'admin_update_user', 'super_admin', ${JSON.stringify(body)})
    `;

    return NextResponse.json({ success: true, user: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await sql.end();
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sql = getDb();

  try {
    const [user] = await sql`SELECT username FROM public.public_mail_users WHERE id = ${id} LIMIT 1`;
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    await deleteStalwartAccount(user.username);
    await sql`DELETE FROM public.public_mail_users WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    await sql.end();
  }
}
