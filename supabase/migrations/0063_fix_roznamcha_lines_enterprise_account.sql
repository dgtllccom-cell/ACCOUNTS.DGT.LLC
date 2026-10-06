-- 0063_fix_roznamcha_lines_enterprise_account.sql
-- Backfills enterprise_account_id on roznamcha_lines rows where it is NULL
-- but the linked ledger has an enterprise_account_id.
-- This fixes ledger statement invisibility: the ledger-report-service filters by enterprise_account_id.

UPDATE roznamcha_lines rl
SET enterprise_account_id = l.enterprise_account_id
FROM ledgers l
WHERE rl.ledger_id = l.id
  AND rl.enterprise_account_id IS NULL
  AND l.enterprise_account_id IS NOT NULL
  AND l.deleted_at IS NULL;

-- Also update any roznamcha_entries that have NULL country_id / country_branch_id
-- when the corresponding ledger has country scoping.
UPDATE roznamcha_entries re
SET
  country_id        = COALESCE(re.country_id, sub.country_id),
  country_branch_id = COALESCE(re.country_branch_id, sub.country_branch_id),
  city_branch_id    = COALESCE(re.city_branch_id, sub.city_branch_id),
  type              = CASE
                        WHEN re.type IS NOT NULL THEN re.type
                        WHEN sub.city_branch_id IS NOT NULL THEN 'branch'
                        WHEN sub.country_id IS NOT NULL THEN 'country'
                        ELSE 'super_admin'
                      END
FROM (
  SELECT DISTINCT
    rl.roznamcha_entry_id,
    l.country_id,
    l.country_branch_id,
    l.city_branch_id
  FROM roznamcha_lines rl
  JOIN ledgers l ON l.id = rl.ledger_id
  WHERE l.deleted_at IS NULL
    AND (l.country_id IS NOT NULL OR l.country_branch_id IS NOT NULL)
) sub
WHERE re.id = sub.roznamcha_entry_id
  AND (re.country_id IS NULL AND re.country_branch_id IS NULL);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
