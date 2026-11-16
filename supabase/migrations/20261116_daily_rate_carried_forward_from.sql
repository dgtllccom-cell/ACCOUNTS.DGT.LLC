-- 20261116: a carried-forward daily rate remembers the approved rate it copies.
-- NULL for rates that were entered. The source row itself is never changed.
ALTER TABLE public.daily_usd_rates
  ADD COLUMN IF NOT EXISTS carried_forward_from date;

COMMENT ON COLUMN public.daily_usd_rates.carried_forward_from IS
  'Rate date of the approved rate this row was carried forward from. NULL when the rate was entered.';
