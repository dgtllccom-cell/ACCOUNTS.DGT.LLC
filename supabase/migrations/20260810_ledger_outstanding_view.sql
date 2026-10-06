-- Outstanding / Recovery ledger source view.
-- Reuses the EXISTING ledgers + ledger_balances tables (no new data store).
-- One row per active ledger/account with a non-zero running balance, plus the
-- date of its last movement (max balance_date) so the app can age it.
-- Aging basis: days since last transaction (per product decision).

CREATE OR REPLACE VIEW public.ledger_outstanding_v AS
SELECT
  l.id,
  l.scope,
  l.country_id,
  l.country_branch_id,
  l.city_branch_id,
  l.account_id,
  l.code,
  l.name,
  l.currency,
  l.opening_balance,
  l.current_balance,
  l.debit_total,
  l.credit_total,
  lb.last_movement_date,
  CASE
    WHEN lb.last_movement_date IS NULL THEN NULL
    ELSE (CURRENT_DATE - lb.last_movement_date)
  END AS days_since_movement
FROM public.ledgers l
LEFT JOIN LATERAL (
  SELECT max(b.balance_date) AS last_movement_date
  FROM public.ledger_balances b
  WHERE b.ledger_id = l.id
) lb ON TRUE
WHERE l.deleted_at IS NULL
  AND l.is_active = TRUE
  AND l.current_balance <> 0;   -- outstanding only

COMMENT ON VIEW public.ledger_outstanding_v IS
  'Active ledgers with non-zero balance + last movement date, for Outstanding/Recovery reports and aging.';

GRANT SELECT ON public.ledger_outstanding_v TO authenticated, service_role;
