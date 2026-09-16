import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { ImapFlow } from "imapflow";

export const dynamic = "force-dynamic";

const moveSchema = z.object({
  fromFolder: z.string(),
  toFolder: z.string(),
  action: z.enum(["archive", "trash", "restore"])
});

/**
 * PATCH /api/erp/email/[accountId]/[messageId]/move
 * Move email to archive, trash, or restore from trash (IMAP MOVE)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string; messageId: string }> }
) {
  try {
    const session = await requireErpSession();
    const { accountId, messageId } = await params;
    const body = await request.json();

    const validation = moveSchema.safeParse(body);
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

    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: true,
      auth: { user: imapUser, pass: imapPass }
    });

    try {
      await client.connect();

      const folderMap: Record<string, string> = {
        inbox: "INBOX",
        sent: "[Gmail]/Sent Mail",
        drafts: "[Gmail]/Drafts",
        trash: "[Gmail]/Trash",
        archived: "[Gmail]/All Mail",
        starred: "[Gmail]/Starred"
      };

      const fromMailbox = folderMap[validation.data.fromFolder] || validation.data.fromFolder;
      let toMailbox = "";

      if (validation.data.action === "archive") {
        toMailbox = "[Gmail]/All Mail";
      } else if (validation.data.action === "trash") {
        toMailbox = "[Gmail]/Trash";
      } else if (validation.data.action === "restore") {
        toMailbox = "INBOX";
      }

      if (!toMailbox) {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }

      await client.mailboxOpen(fromMailbox).catch(() =>
        client.mailboxOpen(validation.data.fromFolder)
      );

      const uid = parseInt(messageId.split('-').pop() || '0', 10);

      if (uid > 0) {
        await client.messageMove(uid, toMailbox);
      }

      await client.logout();

      return NextResponse.json({
        success: true,
        messageId,
        movedTo: toMailbox
      });

    } catch (imapError) {
      console.error("IMAP move error:", imapError);
      throw imapError;
    } finally {
      if (client.mailbox) {
        try { await client.logout(); } catch (e) { /* ignore */ }
      }
    }

  } catch (error) {
    console.error("Move error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to move email"
      },
      { status: 500 }
    );
  }
}
