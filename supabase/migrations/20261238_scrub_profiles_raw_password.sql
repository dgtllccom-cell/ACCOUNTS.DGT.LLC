-- SECURITY (owner-approved 2026-10-19): the legacy plaintext column public.profiles.raw_password must never hold passwords.
-- Login verifies against auth.users.encrypted_password (crypt) and Supabase Auth; no runtime code reads this column and every
-- writer was changed to set it to NULL (2026-09-07 incident fix). This migration only NULLs the stored values — no row, account,
-- role or login is added, removed or changed. The column itself is dropped in a later reviewed migration after a safety period.
-- The translation-enrolment trigger is switched off for this one statement so the scrub has no side effects on translation memory.
-- Idempotent: running it again changes nothing.
do $$
declare
  n integer;
begin
  alter table public.profiles disable trigger trg_enroll_translations;
  update public.profiles set raw_password = null where raw_password is not null;
  get diagnostics n = row_count;
  alter table public.profiles enable trigger trg_enroll_translations;
  raise notice 'profiles.raw_password scrubbed: % row(s) set to NULL', n;
end
$$;

comment on column public.profiles.raw_password is 'DEPRECATED — always NULL since 2026-10-19 (plaintext passwords must never be stored). Scheduled for removal.';
