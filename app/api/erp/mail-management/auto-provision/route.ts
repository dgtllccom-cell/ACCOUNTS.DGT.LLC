import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

/**
 * POST - Auto-provision mailbox for a new Branch/User
 * Automatically creates mailbox, tests IMAP/SMTP, saves credentials
 * Body: { emailAddress, displayName, imapPassword, smtpPassword, imapHost, smtpHost, branchId?, userId? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireErpSession();
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      emailAddress,
      displayName,
      imapPassword,
      smtpPassword,
      imapHost = "mail.dgt.llc",
      imapPort = 993,
      smtpHost = "mail.dgt.llc",
      smtpPort = 465,
      branchId,
      userId,
      storageQuotaMb = 5000,
      planType = "free",
    } = body;

    if (!emailAddress || !imapPassword || !smtpPassword) {
      return NextResponse.json(
        { error: "emailAddress, imapPassword, smtpPassword required" },
        { status: 400 }
      );
    }

    // Test IMAP connection
    let imapStatus = "failed";
    let imapError: string | null = null;
    try {
      const imap = new ImapFlow({
        host: imapHost,
        port: imapPort,
        secure: true,
        auth: { user: emailAddress, pass: imapPassword },
        logger: false,
      });

      await imap.connect();
      imapStatus = "success";
      await imap.logout();
    } catch (err: any) {
      imapError = err.message || "IMAP connection failed";
    }

    // Test SMTP connection
    let smtpStatus = "failed";
    let smtpError: string | null = null;
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: true,
        auth: { user: emailAddress, pass: smtpPassword },
        logger: false,
      });

      await transporter.verify();
      smtpStatus = "success";
    } catch (err: any) {
      smtpError = err.message || "SMTP connection failed";
    }

    // Save mailbox to database
    const admin = createSupabaseAdminClient() as any;

    const encryptedImap = encrypt(imapPassword);
    const encryptedSmtp = encrypt(smtpPassword);

    const { data, error } = await admin.from("erp_email_accounts").upsert(
      {
        email_address: emailAddress,
        display_name: displayName,
        imap_password_encrypted: encryptedImap,
        smtp_password_encrypted: encryptedSmtp,
        imap_host: imapHost,
        imap_port: imapPort,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        is_active: true,
        storage_quota_mb: storageQuotaMb,
        plan_type: planType,
        assigned_branch_id: branchId || null,
        assigned_user_id: userId || null,
        last_connection_status: smtpStatus === "success" && imapStatus === "success" ? "success" : "failed",
        last_connection_test: new Date().toISOString(),
        last_connection_error: imapError || smtpError || null,
      },
      { onConflict: "email_address" }
    );

    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      data: {
        mailbox: data?.[0],
        connectionStatus: {
          imap: { status: imapStatus, error: imapError },
          smtp: { status: smtpStatus, error: smtpError },
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
