-- Cleanup extraneous DEV / TEST users from profiles & user_role_assignments
-- Preserves exactly the 18 master production users:
-- 2 Super Admins, 4 Country Admins, 4 Country Main Branch Admins, 5 City Branch Admins, 4 Clearing Agent Branch Users

UPDATE public.profiles
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND user_code NOT IN (
    'SUPERADMIN',
    'CLEARINGADMIN',
    'TEMP-SUPER-ADMIN',
    'AF-ADMIN',
    'PK-ADMIN',
    'ARE-ADMIN',
    'IR-ADMIN',
    'IN-ADMIN',
    'AFGMAIN001-MAIN-ADMIN',
    'PAKMAIN001-MAIN-ADMIN',
    'AREMAIN001-MAIN-ADMIN',
    'INDMAIN001-MAIN-ADMIN',
    'AFGKDH001-ADMIN',
    'PAKCHM001-ADMIN',
    'PAKQUE001-ADMIN',
    'UAEALRAS001-ADMIN',
    'INDBOM001-ADMIN',
    'CLEARING-AFGKDH001',
    'CLEARING-PAKCHM001',
    'CLEARING-UAEALRAS001',
    'CLEARING-INDBOM001'
  )
  AND user_code NOT LIKE '%SUPERADMIN%'
  AND user_code NOT LIKE '%CLEARING%';

UPDATE public.user_role_assignments
SET deleted_at = NOW()
WHERE deleted_at IS NULL
  AND user_id IN (
    SELECT id FROM public.profiles WHERE deleted_at IS NOT NULL
  );
