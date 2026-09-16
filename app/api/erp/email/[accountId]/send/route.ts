import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { resolveMailboxAccount } from "@/lib/email/resolve-mailbox-account";

export const dynamic = "force-dynamic";

const sendSchema = z.object({
  to: z.string().email(),
  cc: z.string().email().optional().or(z.literal("")),
  bcc: z.string().email().optional().or(z.literal("")),
  subject: z.string().min(1),
  body: z.string().optional(),
  text: z.string().optional(),
  html: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional()
}).refine(data => Boolean(data.body || data.text || data.html), {
  message: "body_required",
  path: ["body"]
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

    const account = await resolveMailboxAccount(accountId);

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const canAccess =
      session.isSuperAdmin ||
      (account.countryId && session.countryIds?.includes(account.countryId)) ||
      (account.countryBranchId && session.countryBranchIds?.includes(account.countryBranchId)) ||
      (account.cityBranchId && session.cityBranchIds?.includes(account.cityBranchId));

    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!account.smtpPass) {
      return NextResponse.json(
        { error: "SMTP password not configured" },
        { status: 400 }
      );
    }

    const transporter = nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: false,
      auth: { user: account.smtpUser, pass: account.smtpPass }
    });

    const domain = account.emailAddress.split("@")[1] || "dgt.llc";
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@${domain}>`;
    const emailBody = validation.data.body || validation.data.text || "";

    const mailOptions: any = {
      from: account.emailAddress,
      to: validation.data.to,
      cc: validation.data.cc || undefined,
      bcc: validation.data.bcc || undefined,
      subject: validation.data.subject,
      text: emailBody,
      html: validation.data.html || undefined,
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

    if (account.imapPass) {
      const imapClient = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        secure: true,
        auth: { user: account.imapUser, pass: account.imapPass }
      });

      try {
        await imapClient.connect();

        const sentDate = new Date().toUTCString();
        const sentRfc5322 = `From: ${account.emailAddress}
To: ${validation.data.to}
${validation.data.cc ? `Cc: ${validation.data.cc}` : ""}
Subject: ${validation.data.subject}
Date: ${sentDate}
Message-ID: ${messageId}
${validation.data.inReplyTo ? `In-Reply-To: ${validation.data.inReplyTo}` : ""}
${validation.data.references ? `References: ${validation.data.references.join(" ")}` : ""}
Content-Type: text/plain; charset=utf-8

${emailBody}`;

        // Append to Sent folder (Titan uses "Sent" not "[Gmail]/Sent Mail")
        await imapClient.append("Sent", sentRfc5322, ["\\Seen"]).catch(() =>
          imapClient.append("[Gmail]/Sent Mail", sentRfc5322, ["\\Seen"])
        );
        await imapClient.logout();
      } catch (imapErr) {
        console.error("Failed to append to sent folder:", imapErr);
      }
    }

    return NextResponse.json({
      success: true,
      messageId
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
