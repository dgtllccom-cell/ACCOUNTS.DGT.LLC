import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";

export interface ResolvedMailboxAccount {
  id: string;
  emailAddress: string;
  displayName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  countryId?: string | null;
  countryBranchId?: string | null;
  cityBranchId?: string | null;
  scope?: string;
}

/**
 * Resolves a mailbox account by UUID or email slug (e.g. "dubai" → "dubai@dgt.llc")
 * Priority for host/port: mailbox-level overrides > provider-level defaults > hardcoded Titan
 * Priority for credentials: encrypted DB columns > env vars (MAILBOX_XXX_PASSWORD)
 */
export async function resolveMailboxAccount(accountId: string): Promise<ResolvedMailboxAccount | null> {
  const admin = createSupabaseAdminClient() as any;
  let account: any = null;

  // 1. Try resolving by UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId);
  if (isUuid) {
    const { data } = await admin
      .from("erp_email_accounts")
      .select("*, erp_email_providers(smtp_host, smtp_port, imap_host, imap_port)")
      .eq("id", accountId)
      .is("deleted_at", null)
      .maybeSingle();
    account = data;
  }

  // 2. Try resolving by email or slug (e.g. "chaman" → "chaman@dgt.llc")
  if (!account) {
    const targetEmail = accountId.includes("@") ? accountId.toLowerCase() : `${accountId.toLowerCase()}@dgt.llc`;
    const { data } = await admin
      .from("erp_email_accounts")
      .select("*, erp_email_providers(smtp_host, smtp_port, imap_host, imap_port)")
      .ilike("email_address", targetEmail)
      .is("deleted_at", null)
      .maybeSingle();
    account = data;
  }

  if (!account) {
    return null;
  }

  // 3. Resolve credentials from encrypted database columns ONLY (no .env fallback)
  const emailAddress = account.email_address || (accountId.includes("@") ? accountId.toLowerCase() : `${accountId.toLowerCase()}@dgt.llc`);
  const slug = emailAddress.split("@")[0].toUpperCase();

  let smtpPass: string | null = null;
  let imapPass: string | null = null;

  // Read from encrypted columns (primary and only source, added by migration 20261117)
  try {
    if (account.smtp_password_encrypted) smtpPass = decrypt(account.smtp_password_encrypted);
  } catch (e) {
    console.error("Failed to decrypt SMTP password:", e);
  }

  try {
    if (account.imap_password_encrypted) imapPass = decrypt(account.imap_password_encrypted);
  } catch (e) {
    console.error("Failed to decrypt IMAP password:", e);
  }

  // Also check settings.smtpPass (legacy: written by old email accounts API)
  if (!smtpPass && account.settings?.smtpPass) {
    try {
      smtpPass = decrypt(account.settings.smtpPass);
    } catch {
      smtpPass = account.settings.smtpPass; // might be plain text from old path
    }
  }

  // NO FALLBACK TO ENVIRONMENT VARIABLES
  // Credentials MUST come from encrypted database storage only

  if (!imapPass && !smtpPass) {
    // Account exists but credentials not yet configured — return partial with empty pass
    // so callers can show "credentials not configured" rather than null
    console.warn(`[resolveMailboxAccount] No credentials found for ${emailAddress}. Returning null.`);
    return null;
  }

  // 4. Resolve host/port: mailbox-level overrides → provider → hardcoded Titan defaults
  const imapHost =
    account.imap_host ||                              // per-mailbox override (migration 20260918)
    account.erp_email_providers?.imap_host ||         // provider-level
    "imap.titan.email";                               // Titan fallback

  const imapPort =
    account.imap_port ||
    account.erp_email_providers?.imap_port ||
    993;

  const smtpHost =
    account.smtp_host ||                              // per-mailbox override
    account.erp_email_providers?.smtp_host ||         // provider-level
    "smtp.titan.email";                               // Titan fallback

  // Titan uses port 465 + SSL (NOT 587/STARTTLS)
  const smtpPort =
    account.smtp_port ||
    account.erp_email_providers?.smtp_port ||
    465;

  // SSL: secure=true for port 465
  const smtpSecure = smtpPort === 465;

  return {
    id: account.id,
    emailAddress,
    displayName: account.display_name || `${slug} Branch`,
    smtpHost,
    smtpPort,
    smtpUser: emailAddress,
    smtpPass: smtpPass || "",
    smtpSecure,
    imapHost,
    imapPort,
    imapUser: emailAddress,
    imapPass: imapPass || "",
    countryId: account.country_id,
    countryBranchId: account.country_branch_id,
    cityBranchId: account.city_branch_id,
    scope: account.scope || "city_branch"
  };
}
