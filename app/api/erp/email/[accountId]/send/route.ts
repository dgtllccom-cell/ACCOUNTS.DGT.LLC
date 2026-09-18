import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { resolveMailboxAccount } from "@/lib/email/resolve-mailbox-account";

export const dynamic = "force-dynamic";

const sendSchema = z.object({
  to: z.string().min(1), // allow comma-separated for multi-recipient
  cc: z.string().optional().or(z.literal("")),
  bcc: z.string().optional().or(z.literal("")),
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
 * Send email via SMTP (Titan/port 587 STARTTLS) and append to Sent folder (sent sync)
 * Supports reply via inReplyTo + references headers
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
      return NextResponse.json({ error: "Account not found or credentials not configured" }, { status: 404 });
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
        { error: "SMTP password not configured. Please set credentials in Mailbox Management." },
        { status: 400 }
      );
    }

    // SMTP transporter — Titan uses port 587 STARTTLS (secure: false)
    const transporter = nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpSecure,   // false for 587 STARTTLS, true for 465 SSL
      auth: { user: account.smtpUser, pass: account.smtpPass },
      tls: {
        rejectUnauthorized: false    // tolerate self-signed on some providers
      }
    });

    const domain = account.emailAddress.split("@")[1] || "dgt.llc";
    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@${domain}>`;
    const emailBody = validation.data.body || validation.data.text || "";

    const mailOptions: nodemailer.SendMailOptions = {
      from: `${account.displayName} <${account.emailAddress}>`,
      to: validation.data.to,
      cc: validation.data.cc || undefined,
      bcc: validation.data.bcc || undefined,
      subject: validation.data.subject,
      text: emailBody,
      html: validation.data.html || undefined,
      messageId,
      headers: {} as Record<string, string>
    };

    // Thread reply headers
    if (validation.data.inReplyTo) {
      (mailOptions.headers as Record<string, string>)["In-Reply-To"] = validation.data.inReplyTo;
    }
    if (validation.data.references && validation.data.references.length > 0) {
      (mailOptions.headers as Record<string, string>)["References"] = validation.data.references.join(" ");
    }

    await transporter.sendMail(mailOptions);

    // ── Sent Sync: append to Sent folder via IMAP ──────────────
    if (account.imapPass) {
      const imapClient = new ImapFlow({
        host: account.imapHost,
        port: account.imapPort,
        secure: true,   // IMAP always uses 993/SSL
        auth: { user: account.imapUser, pass: account.imapPass },
        logger: false,
        tls: { rejectUnauthorized: false }
      });

      try {
        await imapClient.connect();

        const sentDate = new Date().toUTCString();
        const sentRfc5322 = [
          `From: ${account.displayName} <${account.emailAddress}>`,
          `To: ${validation.data.to}`,
          validation.data.cc ? `Cc: ${validation.data.cc}` : "",
          `Subject: ${validation.data.subject}`,
          `Date: ${sentDate}`,
          `Message-ID: ${messageId}`,
          validation.data.inReplyTo ? `In-Reply-To: ${validation.data.inReplyTo}` : "",
          validation.data.references?.length ? `References: ${validation.data.references.join(" ")}` : "",
          "Content-Type: text/plain; charset=utf-8",
          "",
          emailBody
        ].filter(line => line !== "").join("\r\n");

        // Try Titan "Sent" folder first, then common variants
        const sentFolderCandidates = ["Sent", "Sent Items", "INBOX.Sent", "[Gmail]/Sent Mail"];
        let appended = false;
        for (const folder of sentFolderCandidates) {
          try {
            await imapClient.append(folder, sentRfc5322, ["\\Seen"]);
            appended = true;
            break;
          } catch {
            // try next folder
          }
        }
        if (!appended) {
          console.warn("[send-route] Failed to append to any Sent folder for:", account.emailAddress);
        }

        await imapClient.logout();
      } catch (imapErr) {
        // Non-fatal: email was sent, just couldn't sync to Sent folder
        console.error("Failed to append to sent folder:", imapErr);
      }
    }

    return NextResponse.json({
      success: true,
      messageId,
      sentFrom: account.emailAddress
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
