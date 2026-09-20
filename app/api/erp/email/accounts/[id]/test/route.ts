import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveMailboxAccount } from "@/lib/email/resolve-mailbox-account";

export const dynamic = "force-dynamic";

/**
 * Real SMTP AUTH test via nodemailer's verify() (opens a real connection and
 * authenticates against the real server). This previously read credentials
 * from account.settings.smtpPass, a legacy field that was empty/stale for
 * every account actually configured through the encrypted-column path (the
 * one resolveMailboxAccount / the real send/fetch routes use) — meaning this
 * button reported "missing config" for accounts that genuinely work.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return NextResponse.json(
        { ok: false, error: { code: "FORBIDDEN", message: "Only Super Admin can test email account connections." } },
        { status: 403 }
      );
    }
    const { id } = await params;
    const admin = createSupabaseAdminClient() as any;

    const resolved = await resolveMailboxAccount(id);
    if (!resolved) {
      return NextResponse.json(
        { ok: false, error: { code: "MISSING_CONFIG", message: "SMTP parameters missing. Host, Username, and Password are required." } },
        { status: 400 }
      );
    }

    try {
      const transporter = nodemailer.createTransport({
        host: resolved.smtpHost,
        port: resolved.smtpPort,
        secure: resolved.smtpSecure,
        auth: { user: resolved.smtpUser, pass: resolved.smtpPass },
        tls: { rejectUnauthorized: false },
      });
      await transporter.verify();

      await admin.from("erp_email_accounts").update({
        last_tested_at: new Date().toISOString(),
        last_test_result: "success"
      }).eq("id", id);

      return apiOk({ success: true, message: "SMTP connection verified successfully!" });
    } catch (testErr: any) {
      await admin.from("erp_email_accounts").update({
        last_tested_at: new Date().toISOString(),
        last_test_result: testErr.message || "Connection failed"
      }).eq("id", id);

      return NextResponse.json(
        { ok: false, error: { code: "SMTP_FAILED", message: testErr.message || "SMTP connection failed." } },
        { status: 500 }
      );
    }
  } catch (error) {
    return handleApiError(error);
  }
}
