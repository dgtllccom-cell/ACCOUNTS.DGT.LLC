import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { ImapFlow } from "imapflow";

export const dynamic = "force-dynamic";

/**
 * GET /api/erp/email/[accountId]/attachments?folder=...&messageId=...
 * Fetch attachments from IMAP message
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await requireErpSession();
    const { accountId } = await params;
    const { searchParams } = new URL(request.url);
    const folder = searchParams.get("folder") || "INBOX";
    const messageId = searchParams.get("messageId");

    if (!messageId) {
      return NextResponse.json({ error: "messageId required" }, { status: 400 });
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

    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: true,
      auth: { user: imapUser, pass: imapPass }
    });

    try {
      await client.connect();

      // Map folder names (Titan uses simple folder names, not Gmail-style)
      const folderMap: Record<string, string> = {
        inbox: "INBOX",
        sent: "Sent",
        drafts: "Drafts",
        trash: "Trash",
        archived: "Archive",
        spam: "Spam"
      };

      const mailboxName = folderMap[folder] || "INBOX";
      await client.mailboxOpen(mailboxName).catch(() =>
        client.mailboxOpen(folder)
      );

      const uid = parseInt(messageId.split('-').pop() || '0', 10);
      if (uid <= 0) {
        return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });
      }

      const message = await client.fetchOne(uid, { bodyStructure: true });
      if (!message) {
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
      }

      const attachments: Array<{ filename: string; size: number; mimeType: string }> = [];

      // Parse MIME structure for attachments
      const parseStructure = (struct: any): void => {
        if (Array.isArray(struct)) {
          for (const part of struct) {
            if (Array.isArray(part)) {
              parseStructure(part);
            } else if (part && typeof part === 'object') {
              const disposition = part.disposition?.type || '';
              if (disposition === 'attachment' || (disposition === 'inline' && part.filename)) {
                attachments.push({
                  filename: part.filename || 'unknown',
                  size: part.size || 0,
                  mimeType: part.type ? `${part.type}/${part.subtype}` : 'application/octet-stream'
                });
              }
            }
          }
        }
      };

      if (message.bodyStructure) {
        parseStructure(message.bodyStructure);
      }

      await client.logout();

      return NextResponse.json({ attachments });

    } finally {
      if (client.mailbox) {
        try { await client.logout(); } catch (e) { /* ignore */ }
      }
    }

  } catch (error) {
    console.error("Attachment fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch attachments" },
      { status: 500 }
    );
  }
}
