import { NextRequest, NextResponse } from "next/server";
import { getErpSessionForApi } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encrypt, decrypt } from "@/lib/crypto";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

/**
 * GET - List all mailboxes (Super Admin only)
 * SECURITY: Deliberately excludes imap_password_encrypted, smtp_password_encrypted
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getErpSessionForApi();
    if (!session) {
      console.log("[mailbox-api] No session found - returning 401");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[mailbox-api] Session found:", !!session, "SuperAdmin:", session.isSuperAdmin);
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createSupabaseAdminClient() as any;
    const { data: mailboxes, error } = await admin
      .from("erp_email_accounts")
      .select(`
        id, email_address, display_name, is_active,
        storage_quota_mb, storage_used_mb, plan_type,
        assigned_user_id, assigned_branch_id, suspended_at, suspended_reason,
        last_connection_test, last_connection_status, last_connection_error,
        created_at, updated_at
      `)
      .is("deleted_at", null)
      .order("created_at");

    if (error) throw new Error(error.message);

    // SECURITY: Filter to never include encrypted passwords in response
    const safe = mailboxes.map((mb: any) => {
      delete mb.imap_password_encrypted;
      delete mb.smtp_password_encrypted;
      return mb;
    });

    return NextResponse.json({ data: { mailboxes: safe }, ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST - Create or update mailbox with credentials
 * Body: { emailAddress, displayName, imapPassword, smtpPassword, ... }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getErpSessionForApi();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!session.isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const {
      emailAddress,
      displayName,
      provider: providerName = "titan",
      imapHost: customImapHost,
      imapPort: customImapPort,
      imapUsername,
      imapPassword,
      smtpHost: customSmtpHost,
      smtpPort: customSmtpPort,
      smtpUsername,
      smtpPassword,
      storageQuotaMb,
      planType,
      assignedUserId,
      assignedBranchId,
    } = body;

    if (!emailAddress || !imapPassword || !smtpPassword) {
      return NextResponse.json(
        { error: "emailAddress, imapPassword, smtpPassword required" },
        { status: 400 }
      );
    }

    // Auto-fill server settings from provider
    let imapHost = customImapHost || "imap.titan.email";
    let imapPort = customImapPort || 993;
    let smtpHost = customSmtpHost || "smtp.titan.email";
    let smtpPort = customSmtpPort || 465;

    if (providerName === "titan") {
      imapHost = "imap.titan.email";
      imapPort = 993;
      smtpHost = "smtp.titan.email";
      smtpPort = 465;
    } else if (providerName === "custom") {
      if (!customImapHost || !customSmtpHost) {
        return NextResponse.json(
          { error: "Custom provider requires imapHost and smtpHost" },
          { status: 400 }
        );
      }
    }

    const admin = createSupabaseAdminClient() as any;

    // Test credentials before saving (optional: skip with skipConnectionTest flag)
    let testResult: any = { success: true, imap: true, smtp: true };

    if (body.skipConnectionTest !== true) {
      testResult = await testConnection(
        imapHost,
        imapPort,
        imapUsername || emailAddress,
        imapPassword,
        smtpHost,
        smtpPort,
        smtpUsername || emailAddress,
        smtpPassword
      );
      if (!testResult.success) {
        return NextResponse.json(
          { error: `Connection test failed: ${testResult.error}` },
          { status: 400 }
        );
      }
    }

    // Encrypt passwords
    const imapEncrypted = encrypt(imapPassword);
    const smtpEncrypted = encrypt(smtpPassword);

    // Get or create provider
    const { data: provider } = await admin
      .from("erp_email_providers")
      .select("id")
      .eq("domain", "dgt.llc")
      .limit(1)
      .single();

    if (!provider) {
      return NextResponse.json({ error: "Email provider not found" }, { status: 404 });
    }

    // Try to find existing mailbox, then update or insert
    const normalizedEmail = emailAddress.toLowerCase();
    const { data: existing } = await admin
      .from("erp_email_accounts")
      .select("id")
      .eq("email_address", normalizedEmail)
      .limit(1)
      .single();

    let mailbox;
    let upsertError;

    if (existing) {
      // Update existing
      const { data: updated, error: updateError } = await admin
        .from("erp_email_accounts")
        .update({
          provider_id: provider.id,
          display_name: displayName || emailAddress,
          is_active: true,
          imap_password_encrypted: imapEncrypted,
          smtp_password_encrypted: smtpEncrypted,
          storage_quota_mb: storageQuotaMb || 5000,
          plan_type: planType || "free",
          assigned_user_id: assignedUserId,
          assigned_branch_id: assignedBranchId,
          last_connection_test: new Date(),
          last_connection_status: "success",
        })
        .eq("id", existing.id)
        .select("id, email_address")
        .single();
      mailbox = updated;
      upsertError = updateError;
    } else {
      // Insert new
      const { data: inserted, error: insertError } = await admin
        .from("erp_email_accounts")
        .insert({
          provider_id: provider.id,
          email_address: normalizedEmail,
          display_name: displayName || emailAddress,
          is_active: true,
          imap_password_encrypted: imapEncrypted,
          smtp_password_encrypted: smtpEncrypted,
          storage_quota_mb: storageQuotaMb || 5000,
          plan_type: planType || "free",
          assigned_user_id: assignedUserId,
          assigned_branch_id: assignedBranchId,
          last_connection_test: new Date(),
          last_connection_status: "success",
        })
        .select("id, email_address")
        .single();
      mailbox = inserted;
      upsertError = insertError;
    }

    if (upsertError) throw new Error(upsertError.message);

    // Audit log (SECURITY: excludes all password fields)
    await admin.from("erp_email_account_audit").insert({
      account_id: mailbox.id,
      action: "credential_set",
      action_by: session.userId,
      notes: `Credentials configured for ${emailAddress}`,
      old_values: null,
      new_values: {
        email_address: emailAddress,
        display_name: displayName || emailAddress,
        storage_quota_mb: storageQuotaMb || 5000,
        plan_type: planType || "free",
        assigned_user_id: assignedUserId || null,
        assigned_branch_id: assignedBranchId || null
      }
    });

    return NextResponse.json(
      { data: { mailbox, connectionStatus: testResult }, ok: true },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Test IMAP and SMTP connection with configurable servers
 */
async function testConnection(
  imapHost: string,
  imapPort: number,
  imapUser: string,
  imapPass: string,
  smtpHost: string,
  smtpPort: number,
  smtpUser: string,
  smtpPass: string
): Promise<{ success: boolean; error?: string; imap?: boolean; smtp?: boolean }> {
  try {
    // Test IMAP
    const imap = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: true,
      auth: { user: imapUser, pass: imapPass },
    });

    await imap.connect();
    await imap.logout();

    // Test SMTP
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.verify();

    return { success: true, imap: true, smtp: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
