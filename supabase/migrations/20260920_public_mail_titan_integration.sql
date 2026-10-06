-- Links the public webmail system (public_mail_users) to the existing,
-- already-working corporate mailbox infrastructure (erp_email_accounts +
-- erp_email_providers, Hostinger Titan) instead of building a second,
-- parallel mail system. A public_mail_users row that has a real Titan
-- mailbox provisioned for it points at the erp_email_accounts row holding
-- its real encrypted SMTP/IMAP credentials — the same storage, encryption,
-- and send/receive code path already proven working for the 5 corporate
-- mailboxes (chaman@dgt.llc, dubai@dgt.llc, etc).
ALTER TABLE public.public_mail_users
  ADD COLUMN IF NOT EXISTS linked_erp_account_id uuid REFERENCES public.erp_email_accounts(id);

CREATE INDEX IF NOT EXISTS idx_public_mail_users_linked_erp_account
  ON public.public_mail_users (linked_erp_account_id)
  WHERE linked_erp_account_id IS NOT NULL;

-- Marks an erp_email_accounts row as reserved for the public-mail pool
-- (pre-provisioned by an admin, unassigned until a registration claims it)
-- versus a corporate/branch mailbox. Used by the pool-assignment fallback
-- when the Hostinger Mail API is not configured for automatic provisioning.
ALTER TABLE public.erp_email_accounts
  ADD COLUMN IF NOT EXISTS is_public_mail_pool boolean NOT NULL DEFAULT false;

-- Dedup key for real-IMAP-sync-into-public_mail_messages (repurposing the
-- existing, never-populated stalwart_id column rather than adding a new
-- one — stores "imap:<erp_account_id>:<uid>" so re-syncing the same
-- mailbox never inserts the same message twice).
CREATE UNIQUE INDEX IF NOT EXISTS idx_public_mail_messages_dedup
  ON public.public_mail_messages (user_id, stalwart_id)
  WHERE stalwart_id IS NOT NULL;
