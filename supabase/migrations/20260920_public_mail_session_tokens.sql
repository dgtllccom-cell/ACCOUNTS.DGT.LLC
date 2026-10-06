-- SECURITY FIX: the public webmail login cookie ("dgt_mail_user_id") was the
-- raw, unsigned public_mail_users.id — that UUID is visible in several places
-- (admin user lists, audit logs, message metadata), so anyone who obtained it
-- could set it as their own cookie and fully impersonate that mailbox with no
-- password check at all. This adds a real opaque session-token mechanism:
-- login/register now issue a random token, store only its hash, and every
-- route resolves the cookie through that hash instead of trusting it directly
-- as a user id.
ALTER TABLE public.public_mail_users
  ADD COLUMN IF NOT EXISTS session_token_hash text,
  ADD COLUMN IF NOT EXISTS session_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_public_mail_users_session_token_hash
  ON public.public_mail_users (session_token_hash)
  WHERE session_token_hash IS NOT NULL;
