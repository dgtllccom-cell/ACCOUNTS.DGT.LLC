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

      // DEPRECATED: Legacy test endpoint using .env passwords
      // New mailbox testing uses Email Accounts API with encrypted database credentials
      errors.push(`Mailbox testing via .env is deprecated`);
      result.CREATED = false;
      result.ERP_CONNECTED = false;

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
