import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

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

      const mailboxName = folderMap[folder] || "INBOX";
      await client.mailboxOpen(mailboxName).catch(() =>
        client.mailboxOpen(folder)
      );

      // Build search criteria
      const searchCriteria = {
        or: [
          { from: validation.data.query },
          { to: validation.data.query },
          { subject: validation.data.query },
          { text: validation.data.query }
        ]
      };

      const searchResult = await client.search(searchCriteria as any);
      const uids = Array.isArray(searchResult) ? searchResult.slice(-30) : [];

      const results = [];
      for (const uid of uids) {
        try {
          const message = await client.fetchOne(uid, { source: true });
          if (message?.source) {
            const parsed = await simpleParser(message.source as any);
            results.push({
              id: `${accountId}-${uid}`,
              uid,
              from: parsed.from?.text || "",
              to: parsed.to?.text || "",
              subject: parsed.subject || "(no subject)",
              date: parsed.date?.toISOString() || new Date().toISOString(),
              preview: (parsed.text || "").substring(0, 100)
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
