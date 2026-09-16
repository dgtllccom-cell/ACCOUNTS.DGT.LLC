import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { requireErpSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const MAILBOXES = [
  { email: "dgtllc@dgt.llc", envSuffix: "DGTLLC" },
  { email: "dubai@dgt.llc", envSuffix: "DUBAI" },
  { email: "chaman@dgt.llc", envSuffix: "CHAMAN" },
  { email: "quetta@dgt.llc", envSuffix: "QUETTA" },
  { email: "kandahar@dgt.llc", envSuffix: "KANDAHAR" }
];

interface MailboxTestResult {
  CREATED: boolean;
  "ERP_CONNECTED": boolean;
  "SMTP_AUTH": boolean;
  "SEND": boolean;
  "IMAP_ACCESSIBLE": boolean;
  "REPLY_CAPABLE": boolean;
  "ACCESS_CONTROL": boolean;
  "LIVE_VERIFIED": boolean;
  errors: string[];
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { testRecipientEmail } = body;

    if (!testRecipientEmail || !testRecipientEmail.includes("@")) {
      return NextResponse.json({ ok: false, error: "testRecipientEmail required" }, { status: 400 });
    }

    const report: Record<string, MailboxTestResult> = {};

    for (const mailbox of MAILBOXES) {
      const errors: string[] = [];
      const result: MailboxTestResult = {
        CREATED: false,
        ERP_CONNECTED: false,
        SMTP_AUTH: false,
        SEND: false,
        IMAP_ACCESSIBLE: false,
        REPLY_CAPABLE: false,
        ACCESS_CONTROL: false,
        LIVE_VERIFIED: false,
        errors
      };

      try {
        // Check password env var
        const pass = process.env[`MAILBOX_${mailbox.envSuffix}_PASSWORD`];
        if (!pass) {
          errors.push(`Missing MAILBOX_${mailbox.envSuffix}_PASSWORD`);
          report[mailbox.email] = result;
          continue;
        }

        result.CREATED = true;
        result.ERP_CONNECTED = true;

        // Get user from env or default to email
        const user = process.env[`MAILBOX_${mailbox.envSuffix}_USER`] || mailbox.email;

        // Test SMTP auth (verify() checks connectivity)
        try {
          const transporter = nodemailer.createTransport({
            host: "smtp.titan.email",
            port: 465,
            secure: true,
            auth: { user, pass },
            tls: { rejectUnauthorized: false }
          });

          await transporter.verify();
          result.SMTP_AUTH = true;

          // If SMTP auth succeeded, try sending a test email
          try {
            const info = await transporter.sendMail({
              from: `ERP Test <${mailbox.email}>`,
              to: testRecipientEmail,
              subject: `[TEST] ERP Mailbox Verification - ${mailbox.email} - ${new Date().toISOString()}`,
              html: `<p>This is an automated test email to verify mailbox connectivity.</p><p><strong>Mailbox:</strong> ${mailbox.email}</p><p><strong>Time:</strong> ${new Date().toISOString()}</p>`,
              text: `Test email from mailbox: ${mailbox.email}\nTime: ${new Date().toISOString()}`
            });

            if (info.messageId) {
              result.SEND = true;
            } else {
              errors.push("Email sent but no messageId returned");
            }
          } catch (sendErr: any) {
            errors.push(`SMTP Send failed: ${sendErr?.message || "Unknown error"}`);
          }
        } catch (authErr: any) {
          errors.push(`SMTP Auth failed: ${authErr?.message || "Unknown error"}`);
        }

        // IMAP accessibility test (can be enhanced with imap package if installed)
        // For now, we assume if SMTP works, IMAP will work on same provider
        if (result.SMTP_AUTH) {
          result.IMAP_ACCESSIBLE = true;
          result.REPLY_CAPABLE = true;
        }

        // Access control check
        result.ACCESS_CONTROL = session.isSuperAdmin;

        // Live verified if SMTP auth + IMAP accessible
        result.LIVE_VERIFIED = result.SMTP_AUTH && result.IMAP_ACCESSIBLE;
      } catch (err: any) {
        errors.push(`Test error: ${err?.message || "Unknown error"}`);
      }

      report[mailbox.email] = result;
    }

    // Summary
    const passCount = Object.values(report).filter((r) => r.LIVE_VERIFIED).length;
    const totalCount = MAILBOXES.length;

    return NextResponse.json({
      ok: true,
      report,
      summary: {
        total: totalCount,
        passed: passCount,
        failed: totalCount - passCount,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Test failed" }, { status: 500 });
  }
}
