import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { ImapFlow } from "imapflow";
import { resolveMailboxAccount } from "@/lib/email/resolve-mailbox-account";

export const dynamic = "force-dynamic";

export interface EmailMessage {
  id: string;
  uid: number;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  date: string;
  preview: string;
  body: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachment: boolean;
  folder: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await requireErpSession();
    const { accountId } = await params;
    const { searchParams } = new URL(request.url);
    const folder = (searchParams.get("folder") || "inbox").toLowerCase();

    const account = await resolveMailboxAccount(accountId);
    if (!account) {
      return NextResponse.json({ error: "Account not found or credentials missing" }, { status: 404 });
    }

    // Check RBAC - user must have access to this mailbox
    const canAccess =
      session.isSuperAdmin ||
      (account.countryId && session.countryIds?.includes(account.countryId)) ||
      (account.countryBranchId && session.countryBranchIds?.includes(account.countryBranchId)) ||
      (account.cityBranchId && session.cityBranchIds?.includes(account.cityBranchId));

    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Connect to IMAP
    const client = new ImapFlow({
      host: account.imapHost,
      port: account.imapPort,
      secure: true,
      auth: {
        user: account.imapUser,
        pass: account.imapPass
      }
    });

    await client.connect();

    // Map folder names for Titan and standard IMAP
    const folderMap: Record<string, string> = {
      inbox: "INBOX",
      sent: "Sent",
      drafts: "Drafts",
      trash: "Trash",
      archived: "Archive",
      archive: "Archive",
      spam: "Spam",
      starred: "INBOX"
    };

    const targetMailbox = folderMap[folder] || "INBOX";

    try {
      await client.mailboxOpen(targetMailbox);
    } catch {
      try {
        await client.mailboxOpen(targetMailbox.toUpperCase());
      } catch {
        await client.mailboxOpen("INBOX");
      }
    }

    // Fetch recent messages
    const searchCriteria = folder === "starred" ? { flagged: true } : { all: true };
    const searchResult = await client.search(searchCriteria);
    const uids: number[] = Array.isArray(searchResult) ? searchResult.slice(-50).reverse() : [];

    const messages: EmailMessage[] = [];

    for (const uid of uids) {
      try {
        const message = await client.fetchOne(uid, {
          source: true,
          envelope: true,
          flags: true
        });

        if (message && typeof message === "object") {
          const raw = message.source ? message.source.toString() : "";
          const bodyIndex = raw.indexOf("\r\n\r\n") !== -1 ? raw.indexOf("\r\n\r\n") + 4 : raw.indexOf("\n\n") !== -1 ? raw.indexOf("\n\n") + 2 : -1;
          const body = bodyIndex !== -1 ? raw.slice(bodyIndex) : "";

          const subject = message.envelope?.subject || "(no subject)";
          const from = message.envelope?.from?.[0]?.address || "unknown";
          const fromName = message.envelope?.from?.[0]?.name || from.split("@")[0] || "Unknown";
          const to = message.envelope?.to?.[0]?.address || account.emailAddress;
          const dateRaw = message.envelope?.date;
          const date = dateRaw instanceof Date ? dateRaw.toISOString() : typeof dateRaw === "string" ? dateRaw : new Date().toISOString();

          const hasAttachment = raw.toLowerCase().includes("content-disposition: attachment") || raw.toLowerCase().includes("filename=");
          const isRead = message.flags ? !message.flags.has("\\Unseen") : true;
          const isStarred = message.flags ? message.flags.has("\\Flagged") : false;

          messages.push({
            id: `${account.id}-${uid}`,
            uid,
            from,
            fromName,
            to,
            subject,
            date,
            preview: body.slice(0, 140).replace(/\s+/g, " ").trim() || subject,
            body,
            isRead,
            isStarred,
            hasAttachment,
            folder
          });
        }
      } catch (msgErr) {
        console.warn(`Failed to fetch message UID ${uid}:`, msgErr);
      }
    }

    await client.logout();

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("IMAP fetch error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch emails"
      },
      { status: 500 }
    );
  }
}
