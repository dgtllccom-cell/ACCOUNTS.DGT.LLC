import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveMailboxAccount } from "@/lib/email/resolve-mailbox-account";

export const dynamic = "force-dynamic";

/**
 * Real IMAP LOGIN test via ImapFlow. Previously this (a) read credentials
 * from account.settings.smtpPass, a legacy field left empty for accounts
 * actually configured through the encrypted-column path, and (b) never
 * authenticated at all — it just opened a raw TCP socket to the host:port and
 * declared success the instant it connected, so it reported "success" for
 * any reachable server regardless of whether the username/password were even
 * right.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Only Super Admin can test email account connections."
          }
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    const admin = createSupabaseAdminClient() as any;

    const resolved = await resolveMailboxAccount(id);
    if (!resolved) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "MISSING_CONFIG",
            message: "IMAP parameters missing. Host, Username, and Password are required."
          }
        },
        { status: 400 }
      );
    }

    try {
      const imap = new ImapFlow({
        host: resolved.imapHost,
        port: resolved.imapPort,
        secure: true,
        auth: { user: resolved.imapUser, pass: resolved.imapPass },
        logger: false,
        tls: { rejectUnauthorized: false },
      });
      await imap.connect();
      await imap.logout();

      await admin
        .from("erp_email_accounts")
        .update({
          last_tested_at: new Date().toISOString(),
          last_test_result: "IMAP connection verified successfully"
        })
        .eq("id", id);

      return apiOk({
        success: true,
        message: "IMAP connection verified successfully!"
      });
    } catch (testErr: any) {
      await admin
        .from("erp_email_accounts")
        .update({
          last_tested_at: new Date().toISOString(),
          last_test_result: testErr.message || "IMAP connection failed"
        })
        .eq("id", id);

      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "IMAP_FAILED",
            message: testErr.message || "IMAP connection failed."
          }
        },
        { status: 500 }
      );
    }
  } catch (error) {
    return handleApiError(error);
  }
}
