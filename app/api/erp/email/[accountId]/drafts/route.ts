import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireErpSession } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { ImapFlow } from "imapflow";
import { resolveMailboxAccount } from "@/lib/email/resolve-mailbox-account";

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
      const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@${account.emailAddress.split('@')[1]}>`;

      const draftRfc5322 = `From: ${account.emailAddress}
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

      // Append to Drafts folder with \Draft flag (Titan uses "Drafts" not "[Gmail]/Drafts")
      await client.append("Drafts", draftRfc5322, ["\\Draft"]).catch(() =>
        client.append("[Gmail]/Drafts", draftRfc5322, ["\\Draft"]) // Gmail fallback
      );

      await client.logout();

      return NextResponse.json({
        success: true,
        messageId
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

    // Connect to IMAP and fetch drafts
    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure: true,
      auth: { user: imapUser, pass: imapPass }
    });

    try {
      await client.connect();

      // Open Drafts folder (Titan uses "Drafts", Gmail uses "[Gmail]/Drafts")
      try {
        await client.mailboxOpen("Drafts");
      } catch {
        await client.mailboxOpen("[Gmail]/Drafts");
      }

      // Search for all messages
      const searchResult = await client.search({ all: true });
      const uids = Array.isArray(searchResult) ? searchResult.slice(-50) : [];

      const drafts = [];
      for (const uid of uids) {
        try {
          const message = await client.fetchOne(uid, { source: true, envelope: true });
          if (message && typeof message === "object" && "source" in message && message.source) {
            const raw = message.source.toString();
            const bodyIndex = raw.indexOf("\r\n\r\n") !== -1 ? raw.indexOf("\r\n\r\n") + 4 : raw.indexOf("\n\n") !== -1 ? raw.indexOf("\n\n") + 2 : -1;
            const body = bodyIndex !== -1 ? raw.slice(bodyIndex) : "";
            const headerLines = raw.slice(0, Math.max(0, bodyIndex)).split(/\r?\n/);
            const subject = message.envelope?.subject || headerLines.find((l) => l.startsWith("Subject:"))?.replace("Subject:", "").trim() || "(no subject)";
            const to = message.envelope?.to?.[0]?.address || headerLines.find((l) => l.startsWith("To:"))?.replace("To:", "").trim() || "";
            const cc = message.envelope?.cc?.[0]?.address || headerLines.find((l) => l.startsWith("Cc:"))?.replace("Cc:", "").trim() || "";
            const date = message.envelope?.date ? new Date(message.envelope.date).toISOString() : new Date().toISOString();

            drafts.push({
              id: `${accountId}-${uid}`,
              uid,
              subject,
              to,
              cc,
              body,
              date
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
      { error: error instanceof Error ? error.message : "server_error" },
      { status: 500 }
    );
  }
}
