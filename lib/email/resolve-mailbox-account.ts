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

export async function resolveMailboxAccount(accountId: string): Promise<ResolvedMailboxAccount | null> {
  const admin = createSupabaseAdminClient() as any;
  let account: any = null;

  // 1. Try resolving by UUID
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId);
  if (isUuid) {
    const { data } = await admin
      .from("erp_email_accounts")
      .select("*, erp_email_providers(host, port, imap_host, imap_port)")
      .eq("id", accountId)
      .maybeSingle();
    account = data;
  }

  // 2. Try resolving by email or slug (e.g. "chaman" -> "chaman@dgt.llc")
  if (!account) {
    const targetEmail = accountId.includes("@") ? accountId.toLowerCase() : `${accountId.toLowerCase()}@dgt.llc`;
    const { data } = await admin
      .from("erp_email_accounts")
      .select("*, erp_email_providers(host, port, imap_host, imap_port)")
      .ilike("email_address", targetEmail)
      .maybeSingle();
    account = data;
  }

  // 3. Resolve credentials from account settings or environment variables
  const emailAddress = account?.email_address || (accountId.includes("@") ? accountId.toLowerCase() : `${accountId.toLowerCase()}@dgt.llc`);
  const slug = emailAddress.split("@")[0].toUpperCase();
  const envKey = `MAILBOX_${slug}_PASSWORD`;
  const envPass = process.env[envKey] || (slug === "DGTLLC" ? process.env.MAILBOX_DGTLLC_PASSWORD : null) || null;

  const settings = account?.settings || {};
  let smtpPass: string | null = null;
  let imapPass: string | null = null;

  try {
    if (settings.smtp_password) smtpPass = decrypt(settings.smtp_password);
  } catch {
    smtpPass = settings.smtp_password || null;
  }

  try {
    if (settings.imap_password) imapPass = decrypt(settings.imap_password);
  } catch {
    imapPass = settings.imap_password || null;
  }

  smtpPass = smtpPass || envPass;
  imapPass = imapPass || smtpPass || envPass;

  if (!imapPass && !smtpPass) {
    return null;
  }

  const imapHost = account?.erp_email_providers?.imap_host || "imap.titan.email";
  const imapPort = account?.erp_email_providers?.imap_port || 993;
  const smtpHost = account?.erp_email_providers?.host || "smtp.titan.email";
  const smtpPort = account?.erp_email_providers?.port || 587;

  return {
    id: account?.id || accountId,
    emailAddress,
    displayName: account?.display_name || `${slug} Branch`,
    smtpHost,
    smtpPort,
    smtpUser: settings.smtp_user || emailAddress,
    smtpPass: smtpPass || "",
    smtpSecure: false,
    imapHost,
    imapPort,
    imapUser: settings.imap_user || emailAddress,
    imapPass: imapPass || "",
    countryId: account?.country_id,
    countryBranchId: account?.country_branch_id,
    cityBranchId: account?.city_branch_id,
    scope: account?.scope || "city_branch"
  };
}
