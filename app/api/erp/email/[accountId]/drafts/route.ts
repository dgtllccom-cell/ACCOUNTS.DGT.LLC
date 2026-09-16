import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export const dynamic = "force-dynamic";

const saveDraftSchema = z.object({
  subject: z.string().min(1, "Subject required"),
  body: z.string().min(1, "Body required"),
  to: z.string().email("Valid recipient email required"),
  cc: z.string().email().optional().or(z.literal("")),
  bcc: z.string().email().optional().or(z.literal(""))
});

/**
 * POST /api/erp/email/[accountId]/drafts
 * Save draft to IMAP Drafts folder (IMAP Canonical architecture)
 */
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
      .select("*, erp_email_providers(imap_host, imap_port)")
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

    // Get IMAP credentials (drafts stored in IMAP, not database)
    const settings = account.settings || {};
    const imapPass = settings.imap_password ? decrypt(settings.imap_password) : null;

    if (!imapPass) {
      return NextResponse.json(
        { error: "IMAP password not configured" },
        { status: 400 }
      );
    }

    const imapHost = account.erp_email_providers?.imap_host || "imap.titan.email";
    const imapPort = account.erp_email_providers?.imap_port || 993;
    const imapUser = settings.imap_user || account.email_address;

    // Connect to IMAP and save draft
    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: true,
      auth: { user: imapUser, pass: imapPass }
    });

    try {
      await client.connect();

      // Compose RFC 5322 draft message
      const draftDate = new Date().toUTCString();
      const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@${account.email_address.split('@')[1]}>`;

      const draftRfc5322 = `From: ${account.email_address}
To: ${validation.data.to}
${validation.data.cc ? `Cc: ${validation.data.cc}` : ''}
${validation.data.bcc ? `Bcc: ${validation.data.bcc}` : ''}
Subject: ${validation.data.subject}
Date: ${draftDate}
Message-ID: ${messageId}
X-Draft: true
X-Draft-Timestamp: ${new Date().toISOString()}
Content-Type: text/plain; charset=utf-8

${validation.data.body}`;

      // Append to Drafts folder with \Draft flag
      await client.append("[Gmail]/Drafts", draftRfc5322, ["\\Draft"]);

      await client.logout();

      return NextResponse.json({
        success: true,
        messageId,
        message: "Draft saved to IMAP Drafts folder"
      });

    } catch (imapError) {
      console.error("IMAP append error:", imapError);
      throw imapError;
    } finally {
      if (client.mailbox) {
        try { await client.logout(); } catch (e) { /* ignore */ }
      }
    }

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

/**
 * GET /api/erp/email/[accountId]/drafts
 * Fetch drafts from IMAP Drafts folder (IMAP Canonical architecture)
 */
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
      .select("*, erp_email_providers(imap_host, imap_port)")
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

    // Get IMAP credentials
    const settings = account.settings || {};
    const imapPass = settings.imap_password ? decrypt(settings.imap_password) : null;

    if (!imapPass) {
      return NextResponse.json(
        { error: "IMAP password not configured" },
        { status: 400 }
      );
    }

    const imapHost = account.erp_email_providers?.imap_host || "imap.titan.email";
    const imapPort = account.erp_email_providers?.imap_port || 993;
    const imapUser = settings.imap_user || account.email_address;

    // Connect to IMAP and fetch drafts
    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: true,
      auth: { user: imapUser, pass: imapPass }
    });

    try {
      await client.connect();

      // Open Drafts folder (try Gmail first, fallback to standard)
      try {
        await client.mailboxOpen("[Gmail]/Drafts");
      } catch {
        await client.mailboxOpen("Drafts");
      }

      // Search for all messages
      const searchResult = await client.search({ all: true });
      const uids = Array.isArray(searchResult) ? searchResult.slice(-50) : [];

      const drafts = [];
      for (const uid of uids) {
        try {
          const message = await client.fetchOne(uid, { source: true });
          if (message?.source) {
            const parsed = await simpleParser(message.source as any);
            drafts.push({
              id: `${accountId}-${uid}`,
              uid,
              subject: parsed.subject || "(no subject)",
              to: parsed.to?.text || "",
              cc: parsed.cc?.text || "",
              body: parsed.text || "",
              date: parsed.date?.toISOString() || new Date().toISOString()
            });
          }
        } catch (err) {
          console.error(`Failed to parse draft UID ${uid}:`, err);
        }
      }

      await client.logout();

      return NextResponse.json({ drafts });

    } catch (imapError) {
      console.error("IMAP fetch error:", imapError);
      throw imapError;
    } finally {
      if (client.mailbox) {
        try { await client.logout(); } catch (e) { /* ignore */ }
      }
    }

  } catch (error) {
    console.error("Draft fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch drafts" },
      { status: 500 }
    );
  }
}
