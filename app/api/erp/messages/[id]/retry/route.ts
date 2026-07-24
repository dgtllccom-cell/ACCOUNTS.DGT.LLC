import { NextRequest, NextResponse } from "next/server";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendEmailDirect } from "@/lib/email/smtp-client";
import { decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireErpSession();
    const { id } = await params;
    const admin = createSupabaseAdminClient() as any;

    // 1. Fetch the failed message record
    const { data: email, error: fetchErr } = await admin
      .from("erp_email_messages")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!email) {
      return NextResponse.json({ success: false, error: "Email message not found." }, { status: 404 });
    }

    if (email.delivery_status !== "failed") {
      return NextResponse.json({ success: false, error: "Only failed emails can be retried." }, { status: 400 });
    }

    // 2. Resolve country/account SMTP configuration
    const [countryRes, accountRes] = await Promise.all([
      email.country_id
        ? admin.from("countries").select("id, name, email_server_settings").eq("id", email.country_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      email.email_account_id
        ? admin.from("erp_email_accounts").select("id, settings").eq("id", email.email_account_id).maybeSingle()
        : Promise.resolve({ data: null, error: null })
    ]);

    const country = countryRes.data;
    const account = accountRes.data;
    const accountSettings = (account?.settings ?? {}) as Record<string, any>;
    const countrySettings = (country?.email_server_settings ?? {}) as Record<string, any>;

    const smtpConfig = {
      host: accountSettings.smtpHost ?? countrySettings.smtpHost ?? process.env.SMTP_HOST ?? "smtp.gmail.com",
      port: Number(accountSettings.smtpPort ?? countrySettings.smtpPort ?? process.env.SMTP_PORT ?? 465),
      secure: Boolean(accountSettings.smtpSecure !== undefined ? accountSettings.smtpSecure : (countrySettings.smtpSecure !== undefined ? countrySettings.smtpSecure : true)),
      auth: {
        user: accountSettings.smtpUser ?? countrySettings.smtpUser ?? process.env.SMTP_USER ?? email.sender_email ?? "",
        pass: decrypt(accountSettings.smtpPass ?? countrySettings.smtpPass ?? process.env.SMTP_PASS ?? "")
      }
    };

    // 3. Retry sending email
    try {
      const ccParts = email.recipient_cc ? email.recipient_cc.split(",").map((c: string) => c.trim()).filter(Boolean) : [];
      await sendEmailDirect(smtpConfig, {
        from: `"${email.sender_name}" <${email.sender_email}>`,
        to: email.recipient_to,
        cc: ccParts,
        bcc: email.recipient_bcc ?? "",
        subject: email.subject,
        html: email.body, // signed body
        attachments: email.attachments?.map((att: any) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType
        }))
      });

      // 4. Update message status to sent
      const { error: updateErr } = await admin
        .from("erp_email_messages")
        .update({
          delivery_status: "sent",
          sent_at: new Date().toISOString(),
          audit_payload: {
            ...(email.audit_payload || {}),
            errorMessage: null,
            retriedAt: new Date().toISOString()
          }
        })
        .eq("id", id);
      if (updateErr) throw new Error(updateErr.message);

      return apiOk({ success: true, message: "Email retried and sent successfully." });
    } catch (sendErr: any) {
      const errMessage = sendErr.message || "Failed to resend email via SMTP";
      const errCode = sendErr.code || "SMTP_RETRY_FAILED";
      await admin
        .from("erp_email_messages")
        .update({
          audit_payload: {
            ...(email.audit_payload || {}),
            errorMessage: errMessage,
            errorCode: errCode,
            failedTime: new Date().toISOString(),
            lastRetryAt: new Date().toISOString()
          }
        })
        .eq("id", id);

      return NextResponse.json({ success: false, error: `SMTP Error [${errCode}]: ${errMessage}` }, { status: 500 });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
