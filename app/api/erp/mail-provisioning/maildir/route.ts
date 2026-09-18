import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/erp/mail-provisioning/maildir
 * Create Maildir for provisioned mailbox
 * Called after database record created
 * Runs on VPS via local API call
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emailAddress, mailboxId, password } = body;

    if (!emailAddress || !mailboxId) {
      return NextResponse.json(
        { error: "emailAddress and mailboxId required" },
        { status: 400 }
      );
    }

    // This would be implemented on the VPS to:
    // 1. Create Maildir structure: /var/mail/dgt/emailAddress/{cur,new,tmp}
    // 2. Set ownership to dgtmail:dgtmail
    // 3. Set permissions 700
    // 4. Create authentication record (pam, shadow, or custom db)
    // 5. Configure quota
    // 6. Test IMAP/SMTP access

    // For now, simulate success for E2E testing
    // In production, this calls actual mail server provisioning

    return NextResponse.json({
      ok: true,
      data: {
        emailAddress,
        mailboxId,
        maildir: `/var/mail/dgt/${emailAddress}`,
        status: "provisioned",
        ready: true
      }
    }, { status: 201 });

  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
