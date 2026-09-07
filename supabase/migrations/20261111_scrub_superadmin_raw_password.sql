-- Security remediation (2026-09-07)
--
-- Commit 82b09ea hardcoded a Super Admin password in code and shipped a script
-- (scripts/change-superadmin-password.mjs, now removed) that wrote that plaintext
-- value into profiles.raw_password. This migration removes the plaintext copy for
-- the bootstrap Super Admin account. The real credential lives (hashed) in
-- auth.users.encrypted_password and is unaffected — the operator must still ROTATE
-- it in Supabase Auth (see docs/SECURITY-credential-incident-2026-09-07.md).
--
-- Non-destructive: only nulls a plaintext mirror column. No business data touched.
-- Idempotent.

update public.profiles
set raw_password = null,
    updated_at = now()
where raw_password is not null
  and (
    user_code = 'SUPERADMIN'
    or id = '00000000-0000-4000-8000-000000000001'
  );
