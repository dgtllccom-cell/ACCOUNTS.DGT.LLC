-- 0039_daily_usd_rates_branch_index.sql
-- 1. Drop the old unique index that restricts to country-date only
DROP INDEX IF EXISTS public.daily_usd_rates_country_day_idx;

-- 2. Create a new unique index that coalesces branch ID to a default UUID for country-wide fallbacks
CREATE UNIQUE INDEX IF NOT EXISTS daily_usd_rates_country_branch_day_idx 
  ON public.daily_usd_rates (
    country_id, 
    coalesce(country_branch_id, '00000000-0000-0000-0000-000000000000'::uuid), 
    rate_date
  ) 
  WHERE deleted_at IS NULL;

-- 3. Notify postgrest to reload schema cache
NOTIFY pgrst, 'reload schema';
