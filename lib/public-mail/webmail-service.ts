import postgres from "postgres";
import { hashPassword, verifyPassword, generateSessionToken, hashSessionToken } from "./crypto";
import { encrypt } from "../crypto";
import { createStalwartAccount, updateStalwartQuota, setStalwartAccountStatus } from "./stalwart-client";
import { isHostingerProvisioningEnabled, createHostingerMailbox } from "@/lib/email/hostinger-mail-provisioning";
import { claimPoolMailbox } from "@/lib/email/assign-pool-mailbox";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveMailboxAccount } from "@/lib/email/resolve-mailbox-account";
import nodemailer from "nodemailer";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches the cookie's maxAge

/**
 * Issue a new opaque session token for a user, replacing any existing one
 * (single active session). Returns the RAW token — only its hash is stored,
 * so the raw value must be captured here and set directly as the cookie.
 */
export async function createSession(userId: string): Promise<string> {
  const sql = getDb();
  try {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await sql`
      UPDATE public.public_mail_users
      SET session_token_hash = ${tokenHash}, session_expires_at = ${expiresAt}
      WHERE id = ${userId}
    `;
    return token;
  } finally {
    await sql.end();
  }
}

/**
 * Resolve a raw session token (as read from the "dgt_mail_user_id" cookie —
 * name kept for compatibility, value is now an opaque token, not a user id)
 * to the user id it belongs to, or null if the token is missing/expired/
 * revoked. Never trust the cookie value directly as a user id.
 */
export async function resolveSessionUserId(rawToken: string | undefined | null): Promise<string | null> {
  if (!rawToken) return null;
  const sql = getDb();
  try {
    const tokenHash = hashSessionToken(rawToken);
    const [user] = await sql<{ id: string }[]>`
      SELECT id FROM public.public_mail_users
      WHERE session_token_hash = ${tokenHash}
        AND session_expires_at IS NOT NULL
        AND session_expires_at > NOW()
      LIMIT 1
    `;
    return user?.id ?? null;
  } finally {
    await sql.end();
  }
}

/**
 * Revoke a user's active session (logout / password change).
 */
export async function revokeSession(userId: string): Promise<void> {
  const sql = getDb();
  try {
    await sql`
      UPDATE public.public_mail_users
      SET session_token_hash = NULL, session_expires_at = NULL
      WHERE id = ${userId}
    `;
  } finally {
    await sql.end();
  }
}

const RESERVED_USERNAMES = new Set([
"admin",
  "administrator",
  "root",
  "support",
  "billing",
  "info",
  "help",
  "security",
  "postmaster",
  "hostmaster",
  "webmaster",
  "abuse",
  "mailer-daemon",
  "chaman",
  "dubai",
  "quetta",
  "kandahar",
  "dgtllc",
  "dgt",
  "accounts",
  "accounting",
  "finance",
  "system",
]);

function getDb() {
  const url = process.env.DATABASE_URL || "postgresql://postgres.csesvyxxjivnkkozgopt:Gulistan%409090@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";
  return postgres(url, { max: 2, prepare: false, connect_timeout: 10 });
}

export interface PublicMailUser {
  id: string;
  username: string;
  domain: string;
  email_address: string;
  display_name: string;
  recovery_email: string | null;
  phone_number: string | null;
  plan_id: string;
  quota_bytes: number;
  used_bytes: number;
  status: "active" | "suspended" | "pending_verification";
  storage_warning_level: number;
  created_at: string;
  last_login_at: string | null;
  linked_erp_account_id: string | null;
}

export interface MailMessage {
  id: string;
  user_id: string;
  folder: "inbox" | "sent" | "drafts" | "spam" | "trash" | "starred" | "archive";
  sender_email: string;
  sender_name: string | null;
  recipient_email: string;
  subject: string;
  body_text: string | null;
  body_html: string | null;
  snippet: string | null;
  is_read: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  attachments_json: Array<{ name: string; size: number; type: string; url?: string }>;
  size_bytes: number;
  is_verification_code: boolean;
  extracted_code: string | null;
  sender_verified: boolean;
  created_at: string;
}

/**
 * Validate requested username
 */
export function validateUsername(raw: string): { valid: boolean; reason?: string } {
  const username = raw.trim().toLowerCase();
  if (username.length < 3) return { valid: false, reason: "Username must be at least 3 characters" };
  if (username.length > 30) return { valid: false, reason: "Username must be under 30 characters" };
  if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(username)) {
    return { valid: false, reason: "Username can only contain letters, numbers, dots, and hyphens" };
  }
  if (RESERVED_USERNAMES.has(username)) {
    return { valid: false, reason: `The username '${username}' is reserved for official system services` };
  }
  return { valid: true };
}

/**
 * Check if username is available
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const check = validateUsername(username);
  if (!check.valid) return false;

  const sql = getDb();
  try {
    const rows = await sql`
      SELECT id FROM public.public_mail_users
      WHERE username = ${username.toLowerCase()}
      LIMIT 1
    `;
    return rows.length === 0;
  } finally {
    await sql.end();
  }
}

/**
 * Extract verification code (OTP) from email text/subject
 */
export function extractVerificationCode(subject: string, body: string): { isOtp: boolean; code: string | null } {
  const text = `${subject}\n${body}`;
  const patterns = [
    /(?:verification|security|confirmation|one-time|login|auth|passcode|code|pin)(?:[\s\w:]*?)(?:is|:|\s)\s*([0-9]{4,8})\b/i,
    /\b([0-9]{6})\b(?:\s+is your (?:TikTok|Instagram|Facebook|Google|WhatsApp|Microsoft|Meta|Uber|Apple) code)/i,
    /(?:enter code|use code|code is)\s*[:\s]*([0-9]{4,8})/i,
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      return { isOtp: true, code: match[1] };
    }
  }

  return { isOtp: false, code: null };
}

/**
 * Register a new public email user
 */
export async function registerPublicMailUser(params: {
  username: string;
  password: string;
  displayName: string;
  recoveryEmail?: string;
  phoneNumber?: string;
  planId?: string;
}): Promise<{ success: boolean; user?: PublicMailUser; error?: string }> {
  const check = validateUsername(params.username);
  if (!check.valid) return { success: false, error: check.reason };

  const available = await isUsernameAvailable(params.username);
  if (!available) return { success: false, error: "This username is already taken" };

  const username = params.username.toLowerCase();
  const passwordHash = hashPassword(params.password);
  const planId = params.planId || "free_1gb";

  const sql = getDb();
  try {
    // Get plan quota
    const planRows = await sql`
      SELECT storage_bytes FROM public.public_mail_plans WHERE id = ${planId} LIMIT 1
    `;
    const quotaBytes = planRows.length > 0 ? Number(planRows[0].storage_bytes) : 1073741824;

    // Create user in DB
    const [user] = await sql<PublicMailUser[]>`
      INSERT INTO public.public_mail_users (
        username,
        domain,
        password_hash,
        display_name,
        recovery_email,
        phone_number,
        plan_id,
        quota_bytes,
        used_bytes,
        status
      ) VALUES (
        ${username},
        'dgt.llc',
        ${passwordHash},
        ${params.displayName},
        ${params.recoveryEmail || null},
        ${params.phoneNumber || null},
        ${planId},
        ${quotaBytes},
        0,
        'active'
      )
      RETURNING id, username, domain, email_address, display_name, recovery_email, phone_number, plan_id, quota_bytes, used_bytes, status, storage_warning_level, created_at, last_login_at
    `;

    // Provision on Stalwart mail engine (no-op placeholder — nothing runs
    // this today; kept for when/if it's ever stood up, see createStalwartAccount)
    await createStalwartAccount({
      username,
      domain: "dgt.llc",
      password: params.password,
      quotaBytes,
    });

    // Real external send/receive: provision or claim a genuine Titan mailbox
    // and link it. Never blocks registration — a user without a linked
    // mailbox still gets their account and can be linked later by an admin;
    // this only degrades to "internal DGT-to-DGT only" until one is available.
    try {
      const linkedAccountId = await provisionRealMailboxForPublicUser(username);
      if (linkedAccountId) {
        await sql`UPDATE public.public_mail_users SET linked_erp_account_id = ${linkedAccountId} WHERE id = ${user.id}`;
      }
    } catch (e) {
      console.warn(`[registerPublicMailUser] Real mailbox provisioning failed for ${username}@dgt.llc (account still created, internal-only for now):`, e instanceof Error ? e.message : e);
    }

    // Send Welcome Email to the new user's inbox
    const welcomeSubject = "Welcome to your official DGT.LLC email account!";
    const welcomeBody = `Dear ${params.displayName},\n\nWelcome to your new DGT Mail account: ${username}@dgt.llc.\n\nYou now have an independent, secure cloud email address equipped with 1.0 GB of storage. You can freely use this email address to register on TikTok, Instagram, Facebook, Google, and other online platforms.\n\nKey details:\n- Email: ${username}@dgt.llc\n- Storage Quota: 1.0 GB (Upgradable anytime)\n- Webmail Portal: https://dgt.llc/mail\n\nThank you for choosing DGT.LLC!`;

    const welcomeHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 22px;">Welcome to DGT.LLC Mail</h2>
        </div>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">Hello <strong>${params.displayName}</strong>,</p>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">
          Your independent, secure public email account is ready: <strong style="color: #2563eb;">${username}@dgt.llc</strong>.
        </p>
        <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #475569;"><strong>Your Email:</strong> ${username}@dgt.llc</p>
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #475569;"><strong>Storage Tier:</strong> Free Starter (1.0 GB)</p>
          <p style="margin: 0; font-size: 14px; color: #475569;"><strong>Supported Services:</strong> TikTok, Instagram, Meta, Google, Bank OTPs</p>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
          You can upgrade storage, configure anti-spam, and customize your preferences directly in your DGT Mail web portal.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
          DGT.LLC Cloud Communications &bull; Dubai &bull; Chaman &bull; Global
        </p>
      </div>
    `;

    const welcomeSize = Buffer.byteLength(welcomeHtml, "utf8");
    await sql`
      INSERT INTO public.public_mail_messages (
        user_id,
        folder,
        sender_email,
        sender_name,
        recipient_email,
        subject,
        body_text,
        body_html,
        snippet,
        is_read,
        is_starred,
        size_bytes,
        sender_verified
      ) VALUES (
        ${user.id},
        'inbox',
        'welcome@dgt.llc',
        'DGT Mail Team',
        ${user.email_address},
        ${welcomeSubject},
        ${welcomeBody},
        ${welcomeHtml},
        'Welcome to your new DGT Mail account: ' || ${username} || '@dgt.llc...',
        FALSE,
        TRUE,
        ${welcomeSize},
        TRUE
      )
    `;

    // Update used bytes
    await sql`
      UPDATE public.public_mail_users
      SET used_bytes = used_bytes + ${welcomeSize}
      WHERE id = ${user.id}
    `;

    return { success: true, user };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  } finally {
    await sql.end();
  }
}

/**
 * Provisions a real, working Titan mailbox for a new public-mail username
 * and returns the erp_email_accounts.id to link it to, or null if none
 * could be provisioned right now (Hostinger API not configured AND pool
 * empty — a real, expected state until the owner provides one or the
 * other, not an error).
 *
 * Path 1 — Hostinger Mail API (automatic, real mailbox created on demand):
 *   only attempted when HOSTINGER_MAIL_API_TOKEN + HOSTINGER_MAIL_ORDER_ID
 *   are configured. Creates <username>@dgt.llc on the real Titan order,
 *   stores its encrypted credentials in erp_email_accounts exactly like the
 *   5 corporate mailboxes.
 * Path 2 — mailbox pool (fallback): claims the next admin-pre-provisioned,
 *   unassigned erp_email_accounts row tagged is_public_mail_pool = true.
 */
async function provisionRealMailboxForPublicUser(username: string): Promise<string | null> {
  const admin = createSupabaseAdminClient() as any;

  if (isHostingerProvisioningEnabled()) {
    const emailAddress = `${username}@dgt.llc`;
    const { password } = await createHostingerMailbox(username);

    const { data: provider } = await admin
      .from("erp_email_providers")
      .select("id")
      .eq("domain", "dgt.llc")
      .eq("is_active", true)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();

    const encryptedPassword = encrypt(password);
    const { data: account, error } = await admin
      .from("erp_email_accounts")
      .insert({
        provider_id: provider?.id || null,
        email_address: emailAddress,
        display_name: `${username} (Public Mail)`,
        is_active: true,
        plan_type: "public_mail",
        imap_password_encrypted: encryptedPassword,
        smtp_password_encrypted: encryptedPassword,
        storage_quota_mb: 1024,
      })
      .select("id")
      .single();

    if (error || !account) {
      throw new Error(`Hostinger mailbox was created but the erp_email_accounts record failed to save: ${error?.message}`);
    }
    return account.id;
  }

  const claimed = await claimPoolMailbox();
  return claimed?.id ?? null;
}

/**
 * Authenticate public mail user
 */
export async function authenticatePublicMailUser(identifier: string, password: string): Promise<PublicMailUser | null> {
  const cleanId = identifier.trim().toLowerCase().replace(/@dgt\.llc$/, "");
  const sql = getDb();
  try {
    const rows = await sql<Array<PublicMailUser & { password_hash: string }>>`
      SELECT id, username, domain, email_address, password_hash, display_name, recovery_email, phone_number, plan_id, quota_bytes, used_bytes, status, storage_warning_level, created_at, last_login_at
      FROM public.public_mail_users
      WHERE username = ${cleanId}
      LIMIT 1
    `;

    if (rows.length === 0) return null;
    const user = rows[0];

    if (user.status === "suspended") {
      throw new Error("This account has been suspended by administration");
    }

    const match = verifyPassword(password, user.password_hash);
    if (!match) return null;

    // Update last login
    await sql`
      UPDATE public.public_mail_users
      SET last_login_at = NOW()
      WHERE id = ${user.id}
    `;

    const { password_hash: _, ...safeUser } = user;
    return safeUser as PublicMailUser;
  } finally {
    await sql.end();
  }
}

/**
 * Real IMAP sync: pulls new messages from a linked Titan mailbox's real
 * INBOX into public_mail_messages, deduped by IMAP UID (stored in the
 * repurposed stalwart_id column). This is what makes external mail sent TO
 * a linked user's real address (from Gmail, Yahoo, Outlook, etc.) actually
 * show up in their DGT Mail inbox — on-demand, called from getUserMessages,
 * rather than a background poller (no cron infra in this deployment yet).
 * Best-effort: never throws past this function, so a slow/unreachable IMAP
 * server never breaks the inbox view — it just shows what's already synced.
 */
async function syncLinkedMailboxInbox(userId: string, linkedErpAccountId: string): Promise<void> {
  const sql = getDb();
  try {
    const resolved = await resolveMailboxAccount(linkedErpAccountId);
    if (!resolved || !resolved.imapPass) return;

    const { ImapFlow } = await import("imapflow");
    const client = new ImapFlow({
      host: resolved.imapHost,
      port: resolved.imapPort,
      secure: true,
      auth: { user: resolved.imapUser, pass: resolved.imapPass },
      logger: false,
      tls: { rejectUnauthorized: false },
    });

    await client.connect();
    try {
      await client.mailboxOpen("INBOX");
      const uids = await client.search({ all: true });
      const recentUids = (Array.isArray(uids) ? uids : []).slice(-30);

      for (const uid of recentUids) {
        const dedupKey = `imap:${linkedErpAccountId}:${uid}`;
        const [exists] = await sql`
          SELECT 1 FROM public.public_mail_messages WHERE user_id = ${userId} AND stalwart_id = ${dedupKey} LIMIT 1
        `;
        if (exists) continue;

        try {
          const msg = await client.fetchOne(uid, { envelope: true, source: true, flags: true });
          if (!msg || typeof msg !== "object") continue;

          const raw = msg.source ? msg.source.toString() : "";
          const bodyIdx = raw.indexOf("\r\n\r\n") !== -1 ? raw.indexOf("\r\n\r\n") + 4 : raw.indexOf("\n\n") !== -1 ? raw.indexOf("\n\n") + 2 : -1;
          const bodyText = bodyIdx !== -1 ? raw.slice(bodyIdx).replace(/<[^>]+>/g, "").slice(0, 20000) : (msg.envelope?.subject || "");
          const fromAddr = msg.envelope?.from?.[0]?.address || "unknown@unknown";
          const fromName = msg.envelope?.from?.[0]?.name || fromAddr.split("@")[0];
          const subject = msg.envelope?.subject || "(no subject)";
          const hasAttachment = raw.toLowerCase().includes("content-disposition: attachment");
          const size = Buffer.byteLength(raw, "utf8");

          await sql`
            INSERT INTO public.public_mail_messages (
              user_id, folder, sender_email, sender_name, recipient_email,
              subject, body_text, body_html, snippet, is_read, has_attachments,
              size_bytes, sender_verified, stalwart_id
            ) VALUES (
              ${userId}, 'inbox', ${fromAddr}, ${fromName}, ${resolved.emailAddress},
              ${subject}, ${bodyText}, ${'<p>' + bodyText.replace(/\n/g, '<br/>') + '</p>'},
              ${bodyText.slice(0, 120)}, FALSE, ${hasAttachment},
              ${size}, ${fromAddr.endsWith("@dgt.llc")}, ${dedupKey}
            )
            ON CONFLICT DO NOTHING
          `;
        } catch (msgErr) {
          console.warn(`[syncLinkedMailboxInbox] Failed to sync UID ${uid} for ${resolved.emailAddress}:`, msgErr instanceof Error ? msgErr.message : msgErr);
        }
      }
    } finally {
      await client.logout().catch(() => {});
    }
  } catch (e) {
    console.warn(`[syncLinkedMailboxInbox] Sync skipped (IMAP unreachable or misconfigured):`, e instanceof Error ? e.message : e);
  } finally {
    await sql.end();
  }
}

/**
 * Get messages for a user by folder
 */
export async function getUserMessages(userId: string, folder = "inbox", search = ""): Promise<MailMessage[]> {
  if (folder === "inbox") {
    const sqlCheck = getDb();
    try {
      const [user] = await sqlCheck`SELECT linked_erp_account_id FROM public.public_mail_users WHERE id = ${userId} LIMIT 1`;
      if (user?.linked_erp_account_id) {
        await syncLinkedMailboxInbox(userId, user.linked_erp_account_id);
      }
    } finally {
      await sqlCheck.end();
    }
  }

  const sql = getDb();
  try {
    let query;
    if (folder === "starred") {
      query = sql<MailMessage[]>`
        SELECT * FROM public.public_mail_messages
        WHERE user_id = ${userId} AND is_starred = TRUE
        ORDER BY created_at DESC
        LIMIT 100
      `;
    } else {
      query = sql<MailMessage[]>`
        SELECT * FROM public.public_mail_messages
        WHERE user_id = ${userId} AND folder = ${folder}
        ORDER BY created_at DESC
        LIMIT 100
      `;
    }

    const rawMessages = await query;
    const messages = rawMessages.map((m) => {
      let atts = m.attachments_json;
      if (typeof atts === "string") {
        try {
          atts = JSON.parse(atts);
        } catch {
          atts = [];
        }
      }
      return {
        ...m,
        attachments_json: Array.isArray(atts) ? atts : [],
      };
    });

    if (search.trim()) {
      const q = search.toLowerCase();
      return messages.filter(
        (m) =>
          m.subject.toLowerCase().includes(q) ||
          m.sender_email.toLowerCase().includes(q) ||
          (m.snippet && m.snippet.toLowerCase().includes(q))
      );
    }
    return messages;
  } finally {
    await sql.end();
  }
}

/**
 * Send an email from webmail client
 */
export async function sendWebmailMessage(params: {
  userId?: string;
  senderUserId?: string;
  to: string;
  subject: string;
  body: string;
  attachments?: Array<{ name: string; size: number; type: string }>;
  draftId?: string;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const sql = getDb();
  try {
    const senderId = params.userId || params.senderUserId;
    if (!senderId) return { success: false, error: "Sender user ID is required" };

    const [user] = await sql<PublicMailUser[]>`
      SELECT * FROM public.public_mail_users WHERE id = ${senderId} LIMIT 1
    `;
    if (!user) return { success: false, error: "Sender account not found" };
    if (user.status !== "active") return { success: false, error: "Account is not active" };

    const messageSize = Buffer.byteLength(params.body, "utf8") + (params.attachments || []).reduce((a, b) => a + b.size, 0);

    // 1. Quota Check on Sender
    if (Number(user.used_bytes) + messageSize > Number(user.quota_bytes)) {
      return { success: false, error: "Storage quota exceeded. Please delete old emails or upgrade your storage plan." };
    }

    const snippet = params.body.slice(0, 120).replace(/\n/g, " ");

    // 2. Insert into sender's 'sent' folder
    const [msg] = await sql<MailMessage[]>`
      INSERT INTO public.public_mail_messages (
        user_id,
        folder,
        sender_email,
        sender_name,
        recipient_email,
        subject,
        body_text,
        body_html,
        snippet,
        is_read,
        has_attachments,
        attachments_json,
        size_bytes,
        sender_verified
      ) VALUES (
        ${user.id},
        'sent',
        ${user.email_address},
        ${user.display_name},
        ${params.to},
        ${params.subject},
        ${params.body},
        ${'<p>' + params.body.replace(/\n/g, '<br/>') + '</p>'},
        ${snippet},
        TRUE,
        ${(params.attachments || []).length > 0},
        ${JSON.stringify(params.attachments || [])}::jsonb,
        ${messageSize},
        TRUE
      )
      RETURNING *
    `;

    // 3. If draftId was provided, remove the draft
    if (params.draftId) {
      await sql`
        DELETE FROM public.public_mail_messages
        WHERE id = ${params.draftId} AND user_id = ${user.id} AND folder = 'drafts'
      `;
    }

    // 4. Update sender used_bytes and warning level
    const newUsed = Number(user.used_bytes) + messageSize;
    const quota = Number(user.quota_bytes);
    let warningLevel = 0;
    if (newUsed >= quota * 0.95) warningLevel = 3;
    else if (newUsed >= quota * 0.8) warningLevel = 1;

    await sql`
      UPDATE public.public_mail_users
      SET used_bytes = ${newUsed}, storage_warning_level = ${warningLevel}
      WHERE id = ${user.id}
    `;

    // 5. Real delivery for senders with a linked Titan mailbox.
    // Once a public-mail user has a real erp_email_accounts mailbox linked
    // (provisioned via Hostinger's API or claimed from the pool — see
    // provisionRealMailboxForPublicUser), sending goes out through real
    // SMTP to ANY address, internal or external — this is what makes
    // Gmail/Yahoo/Outlook delivery genuine instead of simulated.
    const cleanRecipient = params.to.trim().toLowerCase();
    const isInternalDomain = cleanRecipient.endsWith("@dgt.llc");

    if (user.linked_erp_account_id) {
      // If the recipient is another @dgt.llc public-mail user who does NOT
      // yet have a real mailbox linked, real SMTP would just bounce off a
      // nonexistent Titan mailbox — fall back to the internal DB-to-DB
      // simulation for that one case instead.
      let recipientNeedsInternalFallback = false;
      if (isInternalDomain) {
        const [recipientPmu] = await sql<{ linked_erp_account_id: string | null }[]>`
          SELECT linked_erp_account_id FROM public.public_mail_users WHERE email_address = ${cleanRecipient} LIMIT 1
        `;
        if (recipientPmu && !recipientPmu.linked_erp_account_id) {
          recipientNeedsInternalFallback = true;
        }
      }

      if (!recipientNeedsInternalFallback) {
        const resolved = await resolveMailboxAccount(user.linked_erp_account_id);
        if (!resolved || !resolved.smtpPass) {
          return { success: false, error: "Your linked mailbox credentials are not configured correctly. Contact an administrator." };
        }
        try {
          const transporter = nodemailer.createTransport({
            host: resolved.smtpHost,
            port: resolved.smtpPort,
            secure: resolved.smtpSecure,
            auth: { user: resolved.smtpUser, pass: resolved.smtpPass },
            tls: { rejectUnauthorized: false },
          });
          const info = await transporter.sendMail({
            from: `"${user.display_name}" <${resolved.emailAddress}>`,
            to: cleanRecipient,
            subject: params.subject,
            text: params.body,
            html: '<p>' + params.body.replace(/\n/g, '<br/>') + '</p>',
          });
          return { success: true, messageId: info.messageId || msg.id };
        } catch (e) {
          return { success: false, error: e instanceof Error ? `Real delivery failed: ${e.message}` : "Real delivery failed." };
        }
      }
      // else fall through to the internal simulation below
    }

    // "@dgt.llc" is shared by TWO separate mailbox systems — this public webmail
    // (public_mail_users) and the corporate/branch mailboxes (erp_email_accounts,
    // e.g. chaman@dgt.llc, dubai@dgt.llc). A recipient can be valid and simply
    // live in the other system; only report "Recipient not found" when the
    // address doesn't exist in EITHER.
    if (isInternalDomain) {
      const ingestResult = await ingestIncomingMessage({
        recipientEmail: cleanRecipient,
        senderEmail: user.email_address,
        senderName: user.display_name,
        subject: params.subject,
        bodyText: params.body,
        attachments: params.attachments,
      });
      if (!ingestResult.success) {
        if (ingestResult.error === "Recipient not found") {
          const [corporateMailbox] = await sql<{ id: string }[]>`
            SELECT id FROM public.erp_email_accounts
            WHERE lower(email_address) = ${cleanRecipient} AND is_active = true AND deleted_at IS NULL
            LIMIT 1
          `;
          if (!corporateMailbox) {
            return { success: false, error: "Recipient not found" };
          }
          // Valid corporate mailbox in the other system — recorded in the sender's
          // Sent folder above; cross-system relay to the corporate inbox requires
          // the corporate mail transport (Titan) to be connected, same as any
          // external address. Do not report a false "not found".
        } else {
          return { success: false, error: ingestResult.error || "Recipient mailbox delivery failed (quota exceeded)" };
        }
      }
    } else if (!user.linked_erp_account_id) {
      // Genuinely external address and this sender has no real mailbox yet —
      // be honest instead of silently pretending it was delivered.
      return { success: false, error: "Real external email delivery is not yet enabled for your account. Ask an administrator to link a mailbox to send outside dgt.llc." };
    }

    return { success: true, messageId: msg.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  } finally {
    await sql.end();
  }
}

/**
 * Save or update an email draft
 */
export async function saveDraft(params: {
  userId: string;
  draftId?: string;
  to?: string;
  subject?: string;
  body?: string;
  attachments?: Array<{ name: string; size: number; type: string }>;
}): Promise<{ success: boolean; draftId?: string; error?: string }> {
  const sql = getDb();
  try {
    const [user] = await sql<PublicMailUser[]>`
      SELECT * FROM public.public_mail_users WHERE id = ${params.userId} LIMIT 1
    `;
    if (!user) return { success: false, error: "User not found" };

    const bodyText = params.body || "";
    const subjectText = params.subject || "";
    const toText = params.to || "";
    const attachments = params.attachments || [];
    const messageSize = Buffer.byteLength(bodyText, "utf8") + attachments.reduce((a, b) => a + b.size, 0);

    if (params.draftId) {
      const [updated] = await sql<MailMessage[]>`
        UPDATE public.public_mail_messages
        SET
          recipient_email = ${toText},
          subject = ${subjectText},
          body_text = ${bodyText},
          body_html = ${'<p>' + bodyText.replace(/\n/g, '<br/>') + '</p>'},
          snippet = ${bodyText.slice(0, 120)},
          attachments_json = ${JSON.stringify(attachments)}::jsonb,
          size_bytes = ${messageSize}
        WHERE id = ${params.draftId} AND user_id = ${params.userId} AND folder = 'drafts'
        RETURNING id
      `;
      if (updated) return { success: true, draftId: updated.id };
    }

    const [inserted] = await sql<MailMessage[]>`
      INSERT INTO public.public_mail_messages (
        user_id,
        folder,
        sender_email,
        sender_name,
        recipient_email,
        subject,
        body_text,
        body_html,
        snippet,
        is_read,
        has_attachments,
        attachments_json,
        size_bytes,
        sender_verified
      ) VALUES (
        ${user.id},
        'drafts',
        ${user.email_address},
        ${user.display_name},
        ${toText},
        ${subjectText},
        ${bodyText},
        ${'<p>' + bodyText.replace(/\n/g, '<br/>') + '</p>'},
        ${bodyText.slice(0, 120)},
        TRUE,
        ${attachments.length > 0},
        ${JSON.stringify(attachments)}::jsonb,
        ${messageSize},
        TRUE
      )
      RETURNING id
    `;
    return { success: true, draftId: inserted.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  } finally {
    await sql.end();
  }
}

/**
 * Ingest incoming message (or simulated OTP verification email)
 */
export async function ingestIncomingMessage(params: {
  recipientEmail: string;
  senderEmail: string;
  senderName?: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  attachments?: Array<{ name: string; size: number; type: string }>;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const sql = getDb();
  try {
    const [user] = await sql<PublicMailUser[]>`
      SELECT * FROM public.public_mail_users
      WHERE email_address = ${params.recipientEmail.toLowerCase()}
      LIMIT 1
    `;
    if (!user) return { success: false, error: "Recipient not found" };

    const messageSize = Buffer.byteLength(params.bodyText, "utf8") + (params.attachments || []).reduce((a, b) => a + b.size, 0);

    // Quota Enforcement on Recipient
    if (Number(user.used_bytes) + messageSize > Number(user.quota_bytes)) {
      return { success: false, error: "Recipient storage quota exceeded" };
    }

    const { isOtp, code } = extractVerificationCode(params.subject, params.bodyText);

    const [msg] = await sql<MailMessage[]>`
      INSERT INTO public.public_mail_messages (
        user_id,
        folder,
        sender_email,
        sender_name,
        recipient_email,
        subject,
        body_text,
        body_html,
        snippet,
        is_read,
        has_attachments,
        attachments_json,
        size_bytes,
        is_verification_code,
        extracted_code,
        sender_verified
      ) VALUES (
        ${user.id},
        'inbox',
        ${params.senderEmail},
        ${params.senderName || params.senderEmail},
        ${user.email_address},
        ${params.subject},
        ${params.bodyText},
        ${params.bodyHtml || '<p>' + params.bodyText.replace(/\n/g, '<br/>') + '</p>'},
        ${params.bodyText.slice(0, 120)},
        FALSE,
        ${(params.attachments || []).length > 0},
        ${JSON.stringify(params.attachments || [])}::jsonb,
        ${messageSize},
        ${isOtp},
        ${code},
        TRUE
      )
      RETURNING id
    `;

    // Recalculate usage
    const newUsed = Number(user.used_bytes) + messageSize;
    const quota = Number(user.quota_bytes);
    let warningLevel = 0;
    if (newUsed >= quota * 0.95) warningLevel = 3;
    else if (newUsed >= quota * 0.8) warningLevel = 1;

    await sql`
      UPDATE public.public_mail_users
      SET used_bytes = ${newUsed}, storage_warning_level = ${warningLevel}
      WHERE id = ${user.id}
    `;

    return { success: true, messageId: msg.id };
  } finally {
    await sql.end();
  }
}

/**
 * Reset User Password
 */
export async function resetUserPassword(params: {
  usernameOrEmail?: string;
  email?: string;
  username?: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!params.newPassword || params.newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters long" };
  }
  const target = params.usernameOrEmail || params.email || params.username || "";
  if (!target.trim()) {
    return { success: false, error: "Username or email is required" };
  }
  if (!params.currentPassword) {
    return { success: false, error: "Current password is required" };
  }
  const cleanId = target.trim().toLowerCase().replace(/@dgt\.llc$/, "");
  const newHash = hashPassword(params.newPassword);
  const sql = getDb();
  try {
    const [user] = await sql<(PublicMailUser & { password_hash: string })[]>`
      SELECT id, username, password_hash FROM public.public_mail_users
      WHERE username = ${cleanId}
      LIMIT 1
    `;
    // Same message whether the account doesn't exist or the password is wrong —
    // do not let this endpoint be used to probe which usernames are registered.
    if (!user || !verifyPassword(params.currentPassword, user.password_hash)) {
      return { success: false, error: "Account not found or current password is incorrect" };
    }

    await sql`
      UPDATE public.public_mail_users
      SET password_hash = ${newHash}, updated_at = NOW()
      WHERE id = ${user.id}
    `;

    await sql`
      INSERT INTO public.public_mail_audit_logs (
        user_id,
        action,
        performed_by,
        details
      ) VALUES (
        ${user.id},
        'password_reset',
        'self_service',
        ${JSON.stringify({ username: user.username, timestamp: new Date().toISOString() })}::jsonb
      )
    `;

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  } finally {
    await sql.end();
  }
}

/**
 * Admin: List Public Mail Users
 */
export async function adminListPublicMailUsers(options?: {
  search?: string;
  status?: string;
  plan?: string;
  limit?: number;
  offset?: number;
}): Promise<{ users: PublicMailUser[]; total: number }> {
  const sql = getDb();
  try {
    const search = options?.search ? `%${options.search.toLowerCase()}%` : null;
    const status = options?.status && options.status !== "all" ? options.status : null;
    const plan = options?.plan && options.plan !== "all" ? options.plan : null;
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const rows = await sql<PublicMailUser[]>`
      SELECT id, username, domain, email_address, display_name, recovery_email, phone_number,
             plan_id, quota_bytes, used_bytes, status, storage_warning_level, created_at, last_login_at
      FROM public.public_mail_users
      WHERE (${search}::text IS NULL OR username ILIKE ${search} OR email_address ILIKE ${search} OR display_name ILIKE ${search})
        AND (${status}::text IS NULL OR status = ${status})
        AND (${plan}::text IS NULL OR plan_id = ${plan})
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [countRow] = await sql`
      SELECT count(*)::int as count
      FROM public.public_mail_users
      WHERE (${search}::text IS NULL OR username ILIKE ${search} OR email_address ILIKE ${search} OR display_name ILIKE ${search})
        AND (${status}::text IS NULL OR status = ${status})
        AND (${plan}::text IS NULL OR plan_id = ${plan})
    `;

    return { users: rows, total: countRow ? Number(countRow.count) : rows.length };
  } finally {
    await sql.end();
  }
}

/**
 * Admin: Update Mailbox Status (active / suspended)
 */
export async function adminUpdatePublicMailUserStatus(
  userId: string,
  status: "active" | "suspended",
  performedBy = "admin"
): Promise<{ success: boolean; error?: string }> {
  const sql = getDb();
  try {
    const [user] = await sql<PublicMailUser[]>`
      UPDATE public.public_mail_users
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, username, status
    `;
    if (!user) return { success: false, error: "User not found" };

    await sql`
      INSERT INTO public.public_mail_audit_logs (user_id, action, performed_by, details)
      VALUES (
        ${userId},
        ${status === "active" ? "account_activated" : "account_suspended"},
        ${performedBy},
        ${JSON.stringify({ status, timestamp: new Date().toISOString() })}::jsonb
      )
    `;

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  } finally {
    await sql.end();
  }
}

/**
 * Admin: Update Storage Quota
 */
export async function adminUpdatePublicMailUserQuota(
  userId: string,
  quotaBytes: number,
  planId?: string,
  performedBy = "admin"
): Promise<{ success: boolean; error?: string }> {
  const sql = getDb();
  try {
    const [user] = await sql<PublicMailUser[]>`
      UPDATE public.public_mail_users
      SET quota_bytes = ${quotaBytes},
          plan_id = COALESCE(${planId || null}, plan_id),
          updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, username, quota_bytes, plan_id
    `;
    if (!user) return { success: false, error: "User not found" };

    await sql`
      INSERT INTO public.public_mail_audit_logs (user_id, action, performed_by, details)
      VALUES (
        ${userId},
        'quota_adjusted',
        ${performedBy},
        ${JSON.stringify({ quotaBytes, planId, timestamp: new Date().toISOString() })}::jsonb
      )
    `;

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  } finally {
    await sql.end();
  }
}

/**
 * Admin: Reset User Password
 */
export async function adminResetPublicMailUserPassword(
  userId: string,
  newPassword: string,
  performedBy = "admin"
): Promise<{ success: boolean; error?: string }> {
  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }
  const sql = getDb();
  try {
    const newHash = hashPassword(newPassword);
    const [user] = await sql<PublicMailUser[]>`
      UPDATE public.public_mail_users
      SET password_hash = ${newHash}, updated_at = NOW()
      WHERE id = ${userId}
      RETURNING id, username
    `;
    if (!user) return { success: false, error: "User not found" };

    await sql`
      INSERT INTO public.public_mail_audit_logs (user_id, action, performed_by, details)
      VALUES (
        ${userId},
        'admin_password_reset',
        ${performedBy},
        ${JSON.stringify({ username: user.username, timestamp: new Date().toISOString() })}::jsonb
      )
    `;

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  } finally {
    await sql.end();
  }
}

/**
 * Admin: Get Audit Logs
 */
export async function adminGetPublicMailAuditLogs(userId?: string): Promise<any[]> {
  const sql = getDb();
  try {
    if (userId) {
      return await sql`
        SELECT a.*, u.username, u.email_address
        FROM public.public_mail_audit_logs a
        LEFT JOIN public.public_mail_users u ON u.id = a.user_id
        WHERE a.user_id = ${userId}
        ORDER BY a.created_at DESC
        LIMIT 50
      `;
    }
    return await sql`
      SELECT a.*, u.username, u.email_address
      FROM public.public_mail_audit_logs a
      LEFT JOIN public.public_mail_users u ON u.id = a.user_id
      ORDER BY a.created_at DESC
      LIMIT 100
    `;
  } finally {
    await sql.end();
  }
}

/**
 * Entity Auto-Provisioning:
 * Provisions a DGT Mail mailbox for Country, Main Branch, City Branch, User, or Agent
 */
export async function autoProvisionEntityMailbox(params: {
  entityType: "country" | "main_branch" | "city_branch" | "user" | "agent";
  entityId: string;
  code: string;
  displayName: string;
  customEmail?: string;
  customPassword?: string;
}): Promise<{ success: boolean; email: string; password?: string; error?: string }> {
  const cleanCode = params.code.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  let emailPrefix = cleanCode;

  if (params.entityType === "main_branch") {
    emailPrefix = `${cleanCode}.branch`;
  } else if (params.entityType === "agent") {
    emailPrefix = `${cleanCode}.agent`;
  }

  const email = params.customEmail ? params.customEmail.toLowerCase() : `${emailPrefix}@dgt.llc`;
  const username = email.replace(/@dgt\.llc$/, "");
  const password = params.customPassword || `Dgt@${Math.floor(100000 + Math.random() * 900000)}`;

  // 1. Register or update in public_mail_users
  const sql = getDb();
  try {
    const passwordHash = hashPassword(password);
    const quotaBytes = 5368709120; // 5 GB default for corporate entities

    const [existing] = await sql<PublicMailUser[]>`
      SELECT id FROM public.public_mail_users WHERE username = ${username} LIMIT 1
    `;

    if (existing) {
      await sql`
        UPDATE public.public_mail_users
        SET display_name = ${params.displayName},
            password_hash = ${passwordHash},
            status = 'active',
            updated_at = NOW()
        WHERE id = ${existing.id}
      `;
    } else {
      await sql`
        INSERT INTO public.public_mail_users (
          username, domain, password_hash, display_name, plan_id, quota_bytes, used_bytes, status
        ) VALUES (
          ${username}, 'dgt.llc', ${passwordHash}, ${params.displayName}, 'pro_10gb', ${quotaBytes}, 0, 'active'
        )
      `;
    }

    // 2. Also register in erp_email_accounts if applicable
    try {
      const encPass = encrypt(password);
      const [prov] = await sql`SELECT id FROM public.erp_email_providers WHERE domain = 'dgt.llc' LIMIT 1`;
      const providerId = prov ? prov.id : null;

      await sql`
        INSERT INTO public.erp_email_accounts (
          email_address, display_name, is_active, provider_id,
          imap_password_encrypted, smtp_password_encrypted,
          country_id, country_branch_id, city_branch_id, scope
        ) VALUES (
          ${email}, ${params.displayName}, true, ${providerId},
          ${encPass}, ${encPass},
          ${params.entityType === 'country' ? params.entityId : null},
          ${params.entityType === 'main_branch' ? params.entityId : null},
          ${params.entityType === 'city_branch' ? params.entityId : null},
          ${params.entityType}
        )
        ON CONFLICT (email_address) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          is_active = true,
          imap_password_encrypted = EXCLUDED.imap_password_encrypted,
          smtp_password_encrypted = EXCLUDED.smtp_password_encrypted
      `;
    } catch {
      // erp_email_accounts sync optional
    }

    return { success: true, email, password };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, email, error: msg };
  } finally {
    await sql.end();
  }
}
