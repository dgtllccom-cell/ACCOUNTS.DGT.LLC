import { NextRequest, NextResponse } from "next/server";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { ImapFlow } from "imapflow";

export const dynamic = "force-dynamic";

interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  date: string;
  preview: string;
  isRead: boolean;
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
    const folder = searchParams.get("folder") || "inbox";

    // Verify access to this mailbox
    const admin = createSupabaseAdminClient() as any;
    const { data: account } = await admin
      .from("erp_email_accounts")
      .select("*, erp_email_providers(host, imap_host, imap_port)")
      .eq("id", accountId)
      .single();

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Check RBAC - user must have access to this mailbox
    const canAccess =
      session.isSuperAdmin ||
      (account.country_id && session.countryIds?.includes(account.country_id)) ||
      (account.country_branch_id &&
        session.countryBranchIds?.includes(account.country_branch_id)) ||
      (account.city_branch_id &&
        session.cityBranchIds?.includes(account.city_branch_id));

    if (!canAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Parse stored credentials
    const settings = account.settings || {};
    const smtpPass = settings.smtp_password
      ? decrypt(settings.smtp_password)
      : null;
    const imapPass = settings.imap_password
      ? decrypt(settings.imap_password)
      : smtpPass;

    if (!imapPass) {
      return NextResponse.json(
        { error: "IMAP password not configured" },
        { status: 400 }
      );
    }

    const imapHost = account.erp_email_providers?.imap_host || "imap.titan.email";
    const imapPort = account.erp_email_providers?.imap_port || 993;
    const imapUser = settings.imap_user || account.email_address;

    // Connect to IMAP
    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: true,
      auth: {
        user: imapUser,
        pass: imapPass
      }
    });

    await client.connect();

    // Select folder (map folder names to IMAP mailbox names)
    const folderMap: Record<string, string> = {
      inbox: "INBOX",
      sent: "[Gmail]/Sent Mail",
      drafts: "[Gmail]/Drafts",
      trash: "[Gmail]/Trash",
      archived: "[Gmail]/All Mail",
      starred: "[Gmail]/Starred"
    };

    const mailboxName = folderMap[folder] || "INBOX";

    try {
      await client.mailboxOpen(mailboxName);
    } catch (e) {
      // Fallback for non-Gmail servers
      await client.mailboxOpen(folder === "inbox" ? "INBOX" : folder);
    }

    // Fetch recent messages
    const messages: EmailMessage[] = [];
    const msgSet = await client.search({ all: true }, { limit: 50 });

    for (const uid of msgSet) {
      const message = await client.fetchOne(uid, {
        source: true,
        envelope: true
      });

      if (message) {
        const headerLines = (message.source?.toString() || "").split("\n");
        const subject =
          message.envelope?.subject ||
          headerLines.find((l) => l.startsWith("Subject:"))?.replace("Subject:", "").trim() ||
          "(no subject)";
        const from =
          message.envelope?.from?.[0]?.address ||
          headerLines.find((l) => l.startsWith("From:"))?.replace("From:", "").trim() ||
          "unknown";
        const date =
          message.envelope?.date?.toISOString() ||
          new Date().toISOString();

        messages.push({
          id: `${accountId}-${uid}`,
          from,
          subject,
          date,
          preview: headerLines.slice(0, 3).join(" ").substring(0, 100),
          isRead: !message.flags?.includes("\\Unseen"),
          folder
        });
      }
    }

    await client.logout();

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("IMAP fetch error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch emails"
      },
      { status: 500 }
    );
  }
}
