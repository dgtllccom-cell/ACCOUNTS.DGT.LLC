import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { ImapFlow } from "imapflow";

export const dynamic = "force-dynamic";

const markReadSchema = z.object({
  isRead: z.boolean(),
  folder: z.string().default("inbox")
});

/**
 * PATCH /api/erp/email/[accountId]/[messageId]/read
 * Mark email as read/unread and sync with IMAP
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string; messageId: string }> }
) {
  try {
    const session = await requireErpSession();
    const { accountId, messageId } = await params;
    const body = await request.json();

    const validation = markReadSchema.safeParse(body);
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

    // Connect to IMAP and mark as read/unread
    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: true,
      auth: { user: imapUser, pass: imapPass }
    });

    try {
      await client.connect();

      // Map folder name to IMAP mailbox (Titan uses simple folder names)
      const folderMap: Record<string, string> = {
        inbox: "INBOX",
        sent: "Sent",
        drafts: "Drafts",
        trash: "Trash",
        archived: "Archive",
        spam: "Spam"
      };

      const mailboxName = folderMap[validation.data.folder] || "INBOX";

      // Open mailbox
      await client.mailboxOpen(mailboxName).catch(() =>
        // Fallback for non-Gmail servers
        client.mailboxOpen(validation.data.folder)
      );

      // Extract UID from message ID (assumes format: accountId-uid)
      const uid = parseInt(messageId.split('-').pop() || '0', 10);

      if (uid > 0) {
        // Mark flag
        if (validation.data.isRead) {
          await client.messageFlagsAdd(uid, ["\\Seen"]);
        } else {
          await client.messageFlagsRemove(uid, ["\\Seen"]);
        }
      }

      await client.logout();

      // Store read status in database (optional local cache)
      await admin.from("erp_email_read_status").insert({
        account_id: accountId,
        message_id: messageId,
        is_read: validation.data.isRead,
        updated_at: new Date().toISOString()
      }).upsert();

      return NextResponse.json({
        success: true,
        messageId,
        isRead: validation.data.isRead
      });

    } catch (imapError) {
      console.error("IMAP operation failed:", imapError);
      throw imapError;
    } finally {
      if (client.mailbox) {
        await client.logout();
      }
    }

  } catch (error) {
    console.error("Mark read error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update read status"
      },
      { status: 500 }
    );
  }
}
