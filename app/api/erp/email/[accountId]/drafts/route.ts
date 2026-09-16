import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";

export const dynamic = "force-dynamic";

const saveDraftSchema = z.object({
  subject: z.string().min(1, "Subject required"),
  body: z.string().min(1, "Body required"),
  to: z.string().email("Valid recipient email required"),
  cc: z.string().email().optional().or(z.literal("")),
  bcc: z.string().email().optional().or(z.literal("")),
  attachments: z.array(z.object({
    name: z.string(),
    content: z.string(),
    contentType: z.string()
  })).optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await requireErpSession();
    const { accountId } = await params;
    const body = await request.json();

    const validation = saveDraftSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const admin = createSupabaseAdminClient() as any;
    const { data: account } = await admin
      .from("erp_email_accounts")
      .select("*, erp_email_providers(host, smtp_host, smtp_port)")
      .eq("id", accountId)
      .single();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // RBAC check
    const canAccess =
      session.isSuperAdmin ||
      (account.country_id && session.countryIds?.includes(account.country_id)) ||
      (account.country_branch_id && session.countryBranchIds?.includes(account.country_branch_id)) ||
      (account.city_branch_id && session.cityBranchIds?.includes(account.city_branch_id));

    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get credentials
    const settings = account.settings || {};
    const smtpPass = settings.smtp_password ? decrypt(settings.smtp_password) : null;

    if (!smtpPass) {
      return NextResponse.json(
        { error: "SMTP password not configured" },
        { status: 400 }
      );
    }

    const smtpHost = account.erp_email_providers?.smtp_host || "smtp.titan.email";
    const smtpPort = account.erp_email_providers?.smtp_port || 587;
    const smtpUser = settings.smtp_user || account.email_address;

    // Create draft as email in Drafts folder via IMAP
    // Note: This is a simplified approach; full draft saving would require IMAP APPEND
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass }
    });

    // Compose draft message
    const draftMessage = {
      from: account.email_address,
      to: validation.data.to,
      cc: validation.data.cc || undefined,
      bcc: validation.data.bcc || undefined,
      subject: `[DRAFT] ${validation.data.subject}`,
      text: validation.data.body,
      headers: {
        "X-Draft": "true",
        "X-Draft-Timestamp": new Date().toISOString()
      }
    };

    // For proper IMAP draft support, we would need to:
    // 1. Connect to IMAP with credentials
    // 2. Use IMAP APPEND to add message to Drafts folder
    // For now, store in database and retrieve from there

    // Store draft in database (simplified - create new table for drafts)
    const { data: draft, error: draftError } = await admin
      .from("erp_email_drafts")
      .insert({
        account_id: accountId,
        subject: validation.data.subject,
        body: validation.data.body,
        to: validation.data.to,
        cc: validation.data.cc,
        bcc: validation.data.bcc,
        created_by: session.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (draftError) {
      return NextResponse.json(
        { error: `Failed to save draft: ${draftError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      draftId: draft.id,
      message: "Draft saved successfully"
    });

  } catch (error) {
    console.error("Draft save error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save draft"
      },
      { status: 500 }
    );
  }
}

// GET drafts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await requireErpSession();
    const { accountId } = await params;

    const admin = createSupabaseAdminClient() as any;
    const { data: account } = await admin
      .from("erp_email_accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // RBAC check
    const canAccess =
      session.isSuperAdmin ||
      (account.country_id && session.countryIds?.includes(account.country_id)) ||
      (account.country_branch_id && session.countryBranchIds?.includes(account.country_branch_id)) ||
      (account.city_branch_id && session.cityBranchIds?.includes(account.city_branch_id));

    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch drafts
    const { data: drafts } = await admin
      .from("erp_email_drafts")
      .select("*")
      .eq("account_id", accountId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    return NextResponse.json({ drafts: drafts || [] });

  } catch (error) {
    console.error("Draft fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch drafts" },
      { status: 500 }
    );
  }
}
