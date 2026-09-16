import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { ImapFlow } from "imapflow";
import { resolveMailboxAccount } from "@/lib/email/resolve-mailbox-account";

export const dynamic = "force-dynamic";

const flagSchema = z.object({
  isFlagged: z.boolean(),
  folder: z.string().default("inbox")
});

/**
 * PATCH /api/erp/email/[accountId]/[messageId]/flag
 * Mark email as starred/flagged (sync with IMAP \Flagged flag)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string; messageId: string }> }
) {
  try {
    const session = await requireErpSession();
    const { accountId, messageId } = await params;
    const body = await request.json();

    const validation = flagSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const account = await resolveMailboxAccount(accountId);

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // RBAC check
    const canAccess =
      session.isSuperAdmin ||
      (account.countryId && session.countryIds?.includes(account.countryId)) ||
      (account.countryBranchId && session.countryBranchIds?.includes(account.countryBranchId)) ||
      (account.cityBranchId && session.cityBranchIds?.includes(account.cityBranchId));

    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!account.imapPass) {
      return NextResponse.json(
        { error: "IMAP password not configured" },
        { status: 400 }
      );
    }

    const imapHost = account.imapHost;
    const imapPort = account.imapPort;
    const imapUser = account.imapUser;
    const imapPass = account.imapPass;

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
        sent: "Sent",
        drafts: "Drafts",
        trash: "Trash",
        archived: "Archive",
        spam: "Spam"
      };

      const mailboxName = folderMap[validation.data.folder] || "INBOX";

      await client.mailboxOpen(mailboxName).catch(() =>
        client.mailboxOpen(validation.data.folder)
      );

      const uid = parseInt(messageId.split('-').pop() || '0', 10);

      if (uid > 0) {
        if (validation.data.isFlagged) {
          await client.messageFlagsAdd(uid, ["\\Flagged"]);
        } else {
          await client.messageFlagsRemove(uid, ["\\Flagged"]);
        }
      }

      await client.logout();

      return NextResponse.json({
        success: true,
        messageId,
        isFlagged: validation.data.isFlagged
      });

    } catch (imapError) {
      console.error("IMAP flag operation failed:", imapError);
      throw imapError;
    } finally {
      if (client.mailbox) {
        try { await client.logout(); } catch (e) { /* ignore */ }
      }
    }

  } catch (error) {
    console.error("Flag error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update flag"
      },
      { status: 500 }
    );
  }
}
