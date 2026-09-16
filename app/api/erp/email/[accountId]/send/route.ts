import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

const sendSchema = z.object({
  to: z.string().email("Invalid recipient email"),
  subject: z.string().min(1, "Subject required"),
  body: z.string().min(1, "Message required"),
  cc: z.string().email().optional().or(z.literal("")),
  bcc: z.string().email().optional().or(z.literal(""))
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await requireErpSession();
    const { accountId } = await params;
    const body = await request.json();

    const validation = sendSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    // Verify access to this mailbox
    const admin = createSupabaseAdminClient() as any;
    const { data: account } = await admin
      .from("erp_email_accounts")
      .select("*, erp_email_providers(smtp_host, smtp_port)")
      .eq("id", accountId)
      .single();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Check RBAC
    const canAccess =
      session.isSuperAdmin ||
      (account.country_id && session.countryIds?.includes(account.country_id)) ||
      (account.country_branch_id &&
        session.countryBranchIds?.includes(account.country_branch_id)) ||
      (account.city_branch_id &&
        session.cityBranchIds?.includes(account.city_branch_id));

    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get credentials
    const settings = account.settings || {};
    const smtpPass = settings.smtp_password
      ? decrypt(settings.smtp_password)
      : null;

    if (!smtpPass) {
      return NextResponse.json(
        { error: "SMTP password not configured" },
        { status: 400 }
      );
    }

    const smtpHost =
      account.erp_email_providers?.smtp_host || "smtp.titan.email";
    const smtpPort = account.erp_email_providers?.smtp_port || 587;
    const smtpUser = settings.smtp_user || account.email_address;

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });

    // Send email
    const info = await transporter.sendMail({
      from: account.email_address,
      to: validation.data.to,
      cc: validation.data.cc || undefined,
      bcc: validation.data.bcc || undefined,
      subject: validation.data.subject,
      html: validation.data.body,
      replyTo: account.reply_to || undefined
    });

    // Log to database
    await admin.from("audit_logs").insert({
      action: "email.send",
      resource_type: "email_account",
      resource_id: accountId,
      description: `Email sent to ${validation.data.to}`,
      user_id: session.userId,
      metadata: {
        messageId: info.messageId,
        recipient: validation.data.to,
        subject: validation.data.subject
      }
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId
    });
  } catch (error) {
    console.error("SMTP send error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send email"
      },
      { status: 500 }
    );
  }
}
