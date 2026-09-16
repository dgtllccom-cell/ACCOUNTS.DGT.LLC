import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";

export const dynamic = "force-dynamic";

const sendSchema = z.object({
  to: z.string().email(),
  cc: z.string().email().optional().or(z.literal("")),
  bcc: z.string().email().optional().or(z.literal("")),
  subject: z.string().min(1),
  body: z.string().min(1),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional()
});

/**
 * POST /api/erp/email/[accountId]/send
 * Send email via SMTP and append to Sent folder (sent sync)
 */
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

    const admin = createSupabaseAdminClient() as any;
    const { data: account } = await admin
      .from("erp_email_accounts")
      .select("*, erp_email_providers(smtp_host, smtp_port, imap_host, imap_port)")
      .eq("id", accountId)
      .single();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const canAccess =
      session.isSuperAdmin ||
      (account.country_id && session.countryIds?.includes(account.country_id)) ||
      (account.country_branch_id && session.countryBranchIds?.includes(account.country_branch_id)) ||
      (account.city_branch_id && session.cityBranchIds?.includes(account.city_branch_id));

    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const settings = account.settings || {};
    const smtpPass = settings.smtp_password ? decrypt(settings.smtp_password) : null;
    const imapPass = settings.imap_password ? decrypt(settings.imap_password) : null;

    if (!smtpPass) {
      return NextResponse.json(
        { error: "SMTP password not configured" },
        { status: 400 }
      );
    }

    const smtpHost = account.erp_email_providers?.smtp_host || "smtp.titan.email";
    const smtpPort = account.erp_email_providers?.smtp_port || 587;
    const smtpUser = settings.smtp_user || account.email_address;

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass }
    });

    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@${account.email_address.split('@')[1]}>`;

    const mailOptions: any = {
      from: account.email_address,
      to: validation.data.to,
      cc: validation.data.cc || undefined,
      bcc: validation.data.bcc || undefined,
      subject: validation.data.subject,
      text: validation.data.body,
      messageId,
      headers: {}
    };

    if (validation.data.inReplyTo) {
      mailOptions.headers["In-Reply-To"] = validation.data.inReplyTo;
    }

    if (validation.data.references && validation.data.references.length > 0) {
      mailOptions.headers["References"] = validation.data.references.join(" ");
    }

    await transporter.sendMail(mailOptions);

    if (imapPass) {
      const imapHost = account.erp_email_providers?.imap_host || "imap.titan.email";
      const imapPort = account.erp_email_providers?.imap_port || 993;
      const imapUser = settings.imap_user || account.email_address;

      const imapClient = new ImapFlow({
        host: imapHost,
        port: imapPort,
        secure: true,
        auth: { user: imapUser, pass: imapPass }
      });

      try {
        await imapClient.connect();

        const sentDate = new Date().toUTCString();
        const sentRfc5322 = `From: ${account.email_address}
To: ${validation.data.to}
${validation.data.cc ? `Cc: ${validation.data.cc}` : ''}
Subject: ${validation.data.subject}
Date: ${sentDate}
Message-ID: ${messageId}
${validation.data.inReplyTo ? `In-Reply-To: ${validation.data.inReplyTo}` : ''}
${validation.data.references ? `References: ${validation.data.references.join(" ")}` : ''}
Content-Type: text/plain; charset=utf-8

${validation.data.body}`;

        await imapClient.append("[Gmail]/Sent Mail", sentRfc5322, ["\Seen"]);
        await imapClient.logout();
      } catch (imapErr) {
        console.error("Failed to append to sent folder:", imapErr);
      }
    }

    return NextResponse.json({
      success: true,
      messageId,
      message: "Email sent successfully"
    });

  } catch (error) {
    console.error("Send error:", error);
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
