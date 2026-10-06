/**
 * Mailbox-pool fallback for public webmail provisioning, used whenever the
 * Hostinger Mail API isn't configured (see hostinger-mail-provisioning.ts).
 *
 * The pool is just erp_email_accounts rows with is_public_mail_pool = true
 * and no linked_erp_account_id claiming them yet — real Titan mailboxes an
 * admin pre-creates in hPanel (a few minutes each) and registers via the
 * existing "Add Mailbox" form on /dashboard/dgt-mail-management, exactly
 * like the 5 corporate mailboxes, just tagged for this pool instead of a
 * branch. No new UI needed for that step.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function claimPoolMailbox(): Promise<{ id: string; emailAddress: string } | null> {
  const admin = createSupabaseAdminClient() as any;

  // Atomic claim: only succeeds for one caller if two registrations race for
  // the same free seat, since the WHERE clause re-checks linked_erp_account_id
  // is still null at UPDATE time.
  const { data: candidate } = await admin
    .from("erp_email_accounts")
    .select("id, email_address")
    .eq("is_public_mail_pool", true)
    .eq("is_active", true)
    .is("deleted_at", null)
    .not("smtp_password_encrypted", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!candidate) return null;

  const { data: claimed } = await admin
    .from("erp_email_accounts")
    .update({ is_public_mail_pool: false }) // consumed — no longer "available in the pool"
    .eq("id", candidate.id)
    .eq("is_public_mail_pool", true)
    .select("id, email_address")
    .maybeSingle();

  return claimed ? { id: claimed.id, emailAddress: claimed.email_address } : null;
}

export async function poolAvailableCount(): Promise<number> {
  const admin = createSupabaseAdminClient() as any;
  const { count } = await admin
    .from("erp_email_accounts")
    .select("id", { count: "exact", head: true })
    .eq("is_public_mail_pool", true)
    .eq("is_active", true)
    .is("deleted_at", null)
    .not("smtp_password_encrypted", "is", null);
  return count || 0;
}
