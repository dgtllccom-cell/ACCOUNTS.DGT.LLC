import { NextRequest, NextResponse } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { testSmtpConnection } from "@/lib/email/smtp-client";
import { decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    const admin = createSupabaseAdminClient() as any;

    const { data: account, error } = await admin
      .from("erp_email_accounts")
      .select("id, email_address, settings, is_active")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !account) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: "Email account not found." } },
        { status: 404 }
      );
    }

    const settings = account.settings || {};
    const smtpPass = settings.smtpPass || settings.password || settings.appPassword || "";
    const smtpHost = settings.smtpHost || (account.email_address?.includes("gmail") ? "smtp.gmail.com" : "smtp.office365.com");
    const smtpPort = Number(settings.smtpPort || 465);
    const smtpSecure = settings.smtpSecure !== undefined ? settings.smtpSecure : true;
    const smtpUser = settings.smtpUser || account.email_address || "";
    const decryptedPass = decrypt(smtpPass);

    if (!smtpHost || !smtpUser || !decryptedPass) {
      // Update test result
      await admin.from("erp_email_accounts").update({
        last_tested_at: new Date().toISOString(),
        last_test_result: "SMTP parameters missing (Host, Username, or Password)"
      }).eq("id", id);

      return NextResponse.json(
        { ok: false, error: { code: "MISSING_CONFIG", message: "SMTP parameters missing. Host, Username, and Password are required." } },
        { status: 400 }
      );
    }

    try {
      await testSmtpConnection({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: decryptedPass }
      });

      // Update success
      await admin.from("erp_email_accounts").update({
        last_tested_at: new Date().toISOString(),
        last_test_result: "success"
      }).eq("id", id);

      return apiOk({ success: true, message: "SMTP connection verified successfully!" });
    } catch (testErr: any) {
      // Update failure
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
