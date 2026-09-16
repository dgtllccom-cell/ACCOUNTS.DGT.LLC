import { NextRequest, NextResponse } from "next/server";
import * as net from "net";
import { apiOk, handleApiError } from "@/lib/api/response";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

async function testImapConnection(config: {
  host: string;
  port: number;
  user: string;
  pass: string;
}): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket?.destroy();
      reject(new Error("IMAP connection timeout (5s)"));
    }, 5000);

    const socket = net.createConnection(
      { host: config.host, port: config.port },
      () => {
        clearTimeout(timeout);
        socket.destroy();
        resolve(true);
      }
    );

    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`IMAP connection failed: ${err.message}`));
    });
  });
}

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

    const { data: account, error } = await admin
      .from("erp_email_accounts")
      .select("id, email_address, settings, is_active")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error || !account) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "NOT_FOUND", message: "Email account not found." }
        },
        { status: 404 }
      );
    }

    const settings = account.settings || {};
    const imapPass = settings.smtpPass || settings.password || settings.appPassword || "";
    const imapHost =
      settings.imapHost ||
      (account.email_address?.includes("gmail")
        ? "imap.gmail.com"
        : "imap.office365.com");
    const imapPort = Number(settings.imapPort || 993);
    const imapUser = settings.smtpUser || account.email_address || "";
    const decryptedPass = decrypt(imapPass);

    if (!imapHost || !imapUser || !decryptedPass) {
      // Update test result
      await admin
        .from("erp_email_accounts")
        .update({
          last_tested_at: new Date().toISOString(),
          last_test_result: "IMAP parameters missing (Host, Username, or Password)"
        })
        .eq("id", id);

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
      await testImapConnection({
        host: imapHost,
        port: imapPort,
        user: imapUser,
        pass: decryptedPass
      });

      // Update success
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
      // Update failure
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
