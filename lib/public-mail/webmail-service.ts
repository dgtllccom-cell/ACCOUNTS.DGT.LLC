import postgres from "postgres";
import { hashPassword, verifyPassword } from "./crypto";
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

    const messages = await query;
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
  userId: string;
  to: string;
  subject: string;
  body: string;
  attachments?: Array<{ name: string; size: number; type: string }>;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const sql = getDb();
  try {
    const [user] = await sql<PublicMailUser[]>`
      SELECT * FROM public.public_mail_users WHERE id = ${params.userId} LIMIT 1
    `;
    if (!user) return { success: false, error: "Sender account not found" };
    if (user.status !== "active") return { success: false, error: "Account is not active" };

    const messageSize = Buffer.byteLength(params.body, "utf8") + (params.attachments || []).reduce((a, b) => a + b.size, 0);

    // Check storage quota
    if (Number(user.used_bytes) + messageSize > Number(user.quota_bytes)) {
      return { success: false, error: "Storage quota exceeded. Please delete old emails or upgrade your storage plan." };
    }

    const snippet = params.body.slice(0, 120).replace(/\n/g, " ");

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
        ${`<p>${params.body.replace(/\n/g, "<br/>")}</p>`},
        ${snippet},
        TRUE,
        ${(params.attachments || []).length > 0},
        ${JSON.stringify(params.attachments || [])}::jsonb,
        ${messageSize},
        TRUE
      )
      RETURNING *
    `;

    // Recalculate storage used and warning level
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
}): Promise<{ success: boolean; messageId?: string }> {
  const sql = getDb();
  try {
    const [user] = await sql<PublicMailUser[]>`
      SELECT * FROM public.public_mail_users
      WHERE email_address = ${params.recipientEmail.toLowerCase()}
      LIMIT 1
    `;
    if (!user) return { success: false };

    const { isOtp, code } = extractVerificationCode(params.subject, params.bodyText);
    const messageSize = Buffer.byteLength(params.bodyText, "utf8") + (params.attachments || []).reduce((a, b) => a + b.size, 0);

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
        ${params.bodyHtml || `<p>${params.bodyText.replace(/\n/g, "<br/>")}</p>`},
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
