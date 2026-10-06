-- =====================================================================
--  DIGITAL DOCK ERP — DEFAULT SYSTEM EMAIL (temporary, all countries)
-- ---------------------------------------------------------------------
--  Sets dgt.llc.com@gmail.com as the default sender for ALL countries and
--  branches until each has its own official email (configured later via
--  Settings -> Email Configuration, table erp_email_accounts — no code change).
--
--  NOTE: the code-level global default (lib/email/country-email-config.ts,
--  GLOBAL_DEFAULT_EMAIL) already makes this the default even with NO row here.
--  This row makes it explicit/canonical in the Email Configuration screen and
--  is what admins will later duplicate per-branch.
--
--  erp_email_accounts has a UNIQUE index on lower(email_address), so the same
--  address is stored ONCE (super_admin scope = system-wide default). Per-branch
--  emails will be DIFFERENT addresses, added later from the settings screen.
-- =====================================================================
BEGIN;

INSERT INTO public.erp_email_accounts
  (scope, display_name, email_address, admin_email, reply_to,
   cc_super_admin, cc_country_admin, is_default, is_active, settings)
VALUES
  ('super_admin', 'Digital Dock ERP', 'dgt.llc.com@gmail.com',
   'dgt.llc.com@gmail.com', 'dgt.llc.com@gmail.com',
   true, true, true, true, '{}'::jsonb)
ON CONFLICT (lower(email_address)) WHERE deleted_at IS NULL
DO UPDATE SET scope='super_admin', display_name=EXCLUDED.display_name,
              admin_email=EXCLUDED.admin_email, reply_to=EXCLUDED.reply_to,
              is_default=true, is_active=true, updated_at=now();

-- Make sure no OTHER row is still marked default (only the gmail is default now):
UPDATE public.erp_email_accounts
SET    is_default=false, updated_at=now()
WHERE  deleted_at IS NULL
  AND  lower(email_address) <> 'dgt.llc.com@gmail.com'
  AND  is_default = true;

-- PREVIEW / VERIFY:
SELECT scope, display_name, email_address, reply_to, is_default, is_active
FROM   public.erp_email_accounts
WHERE  deleted_at IS NULL
ORDER  BY is_default DESC, scope;

-- COMMIT;   -- after verifying the row above
ROLLBACK;   -- <-- change to COMMIT

-- =====================================================================
-- LATER (per-branch, from the UI — no code/SQL needed):
--   Settings -> Email Configuration -> Add account
--     Scope = country / country_branch / city_branch
--     Display Name, Email Address (branch's own), Reply-To, Admin email,
--     SMTP settings (in the JSON 'settings' field)
--   The resolver automatically uses the most specific configured email:
--     city_branch -> country_branch -> country -> super_admin default (gmail).
-- =====================================================================
