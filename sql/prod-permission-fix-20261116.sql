-- Production, 2026-11-16: UAE Country Admin could not save daily USD rates.
-- Cause: this user has a MANUAL permission set (user_permission_sets.source = 'manual') without any
-- currency_rates permission. A saved set overrides the role default, so POST /api/erp/currency/daily-rates
-- returned 403 "Missing permission: currency_rates:create" (seen in the live nginx log, 15-16 Nov).
-- Fix: additive grant of the three rate permissions the Country Admin role already holds by default.
-- user fcebbbcd-e54d-4227-a782-cb3ffe4dadfb = Country Admin, UAE (country 582526d0-0375-41e9-8eba-ccbd2a5e3a0f).

-- APPLY (already applied on production 2026-11-16; 113 -> 116 permissions):
update public.user_permission_sets
set permissions = array(select distinct unnest(permissions || array['currency_rates:create','currency_rates:read','currency_rates:update']::text[]))
where user_id = 'fcebbbcd-e54d-4227-a782-cb3ffe4dadfb'
  and source = 'manual'
  and not (permissions @> array['currency_rates:create']::text[]);

-- ROLLBACK (removes only the three strings this change added; none existed before):
-- update public.user_permission_sets
-- set permissions = array(select p from unnest(permissions) p where p not in ('currency_rates:create','currency_rates:read','currency_rates:update'))
-- where user_id = 'fcebbbcd-e54d-4227-a782-cb3ffe4dadfb' and source = 'manual';
