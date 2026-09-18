import postgres from "postgres";
import { hashPassword, verifyPassword } from "./crypto";
import { encrypt } from "../crypto";
import { createStalwartAccount, updateStalwartQuota, setStalwartAccountStatus } from "./stalwart-client";

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

    // Provision on Stalwart mail engine
    await createStalwartAccount({
      username,
      domain: "dgt.llc",
      password: params.password,
      quotaBytes,
    });

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
 * Get messages for a user by folder
 */
export async function getUserMessages(userId: string, folder = "inbox", search = ""): Promise<MailMessage[]> {
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

    // 5. DGT-to-DGT Real Delivery: If recipient is also on @dgt.llc, deliver to their inbox!
    const cleanRecipient = params.to.trim().toLowerCase();
    if (cleanRecipient.endsWith("@dgt.llc")) {
      const ingestResult = await ingestIncomingMessage({
        recipientEmail: cleanRecipient,
        senderEmail: user.email_address,
        senderName: user.display_name,
        subject: params.subject,
        bodyText: params.body,
        attachments: params.attachments,
      });
      if (!ingestResult.success) {
        return { success: false, error: ingestResult.error || "Recipient mailbox delivery failed (quota exceeded)" };
      }
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
  newPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!params.newPassword || params.newPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters long" };
  }
  const target = params.usernameOrEmail || params.email || params.username || "";
  if (!target.trim()) {
    return { success: false, error: "Username or email is required" };
  }
  const cleanId = target.trim().toLowerCase().replace(/@dgt\.llc$/, "");
  const newHash = hashPassword(params.newPassword);
  const sql = getDb();
  try {
    const [user] = await sql<PublicMailUser[]>`
      SELECT id, username FROM public.public_mail_users
      WHERE username = ${cleanId}
      LIMIT 1
    `;
    if (!user) return { success: false, error: "Account not found" };

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
