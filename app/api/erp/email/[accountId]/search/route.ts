import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { ImapFlow } from "imapflow";
import { resolveMailboxAccount } from "@/lib/email/resolve-mailbox-account";

export const dynamic = "force-dynamic";

const searchSchema = z.object({
  query: z.string().min(1, "Search query required"),
  folder: z.string().default("INBOX")
});

/**
 * GET /api/erp/email/[accountId]/search?query=...&folder=...
 * Search emails via IMAP
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const session = await requireErpSession();
    const { accountId } = await params;
    const { searchParams } = new URL(request.url);

    const query = searchParams.get("query");
    const folder = searchParams.get("folder") || "INBOX";

    const validation = searchSchema.safeParse({ query, folder });
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid search" },
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

      const mailboxName = folderMap[folder] || "INBOX";
      await client.mailboxOpen(mailboxName).catch(() =>
        client.mailboxOpen(folder)
      );

      // Build search criteria using IMAP search syntax
      // Search for query in FROM, TO, SUBJECT, or TEXT fields
      const q = validation.data.query;
      const searchCriteria = [
        "OR",
        ["OR", ["FROM", q], ["TO", q]],
        ["OR", ["SUBJECT", q], ["TEXT", q]]
      ];

      const searchResult = await client.search(searchCriteria as any);
      const uids = Array.isArray(searchResult) ? searchResult.slice(-30) : [];

      const results = [];
      for (const uid of uids) {
        try {
          const message = await client.fetchOne(uid, { source: true, envelope: true });
          if (message && typeof message === "object" && "source" in message && message.source) {
            const raw = message.source.toString();
            const bodyIndex = raw.indexOf("\r\n\r\n") !== -1 ? raw.indexOf("\r\n\r\n") + 4 : raw.indexOf("\n\n") !== -1 ? raw.indexOf("\n\n") + 2 : -1;
            const bodyText = bodyIndex !== -1 ? raw.slice(bodyIndex) : "";
            const headerLines = raw.slice(0, Math.max(0, bodyIndex)).split(/\r?\n/);
            const subject = message.envelope?.subject || headerLines.find((l) => l.startsWith("Subject:"))?.replace("Subject:", "").trim() || "(no subject)";
            const from = message.envelope?.from?.[0]?.address || headerLines.find((l) => l.startsWith("From:"))?.replace("From:", "").trim() || "";
            const to = message.envelope?.to?.[0]?.address || headerLines.find((l) => l.startsWith("To:"))?.replace("To:", "").trim() || "";
            const date = message.envelope?.date ? new Date(message.envelope.date).toISOString() : new Date().toISOString();

            results.push({
              id: `${accountId}-${uid}`,
              uid,
              from,
              to,
              subject,
              date,
              preview: bodyText.slice(0, 100).replace(/\s+/g, " ")
            });
          }
        } catch (err) {
          console.error(`Failed to parse search result UID ${uid}:`, err);
        }
      }

      await client.logout();

      return NextResponse.json({ results, count: results.length });

    } finally {
      if (client.mailbox) {
        try { await client.logout(); } catch (e) { /* ignore */ }
      }
    }

  } catch (error) {
    console.error("Email search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 }
    );
  }
}
