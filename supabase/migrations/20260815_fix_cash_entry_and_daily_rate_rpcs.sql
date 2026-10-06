-- =====================================================================
-- 20260815_fix_cash_entry_and_daily_rate_rpcs.sql
-- Provide idempotent, robust SQL definitions for get_branch_cash_summary
-- and get_daily_rate to resolve Cash Entry RPC schema cache lookup errors.
-- =====================================================================

create or replace function public.get_branch_cash_summary(
  p_country_id uuid,
  p_country_branch_id uuid default null,
  p_date text default null
)
returns table(
  total_debit numeric,
  total_credit numeric,
  balance numeric,
  entry_count bigint
) language plpgsql stable set search_path = public as $$
declare
  v_date text := coalesce(p_date, to_char(now(), 'YYYY-MM-DD'));
begin
  return query
  select
    coalesce(sum(l.debit), 0)::numeric as total_debit,
    coalesce(sum(l.credit), 0)::numeric as total_credit,
    (coalesce(sum(l.credit), 0) - coalesce(sum(l.debit), 0))::numeric as balance,
    count(distinct e.id)::bigint as entry_count
  from public.roznamcha_entries e
  left join public.roznamcha_lines l on l.roznamcha_entry_id = e.id
  where e.deleted_at is null
    and e.country_id = p_country_id
    and (p_country_branch_id is null or e.country_branch_id = p_country_branch_id)
    and e.entry_date = v_date;
end;
$$;

create or replace function public.get_daily_rate(
  p_country_id uuid,
  p_country_branch_id uuid default null,
  p_date text default null
)
returns table(
  rate_date text,
  buying_rate numeric,
  selling_rate numeric,
  credit_rate numeric,
  debit_rate numeric,
  is_exact_date boolean,
  is_branch_specific boolean
) language plpgsql stable set search_path = public as $$
declare
  v_date text := coalesce(p_date, to_char(now(), 'YYYY-MM-DD'));
begin
  return query
  select
    r.rate_date::text,
    r.buying_rate::numeric,
    r.selling_rate::numeric,
    r.credit_rate::numeric,
    r.debit_rate::numeric,
    (r.rate_date = v_date) as is_exact_date,
    (r.country_branch_id is not null) as is_branch_specific
  from public.daily_usd_rates r
  where r.deleted_at is null
    and r.country_id = p_country_id
    and (p_country_branch_id is null or r.country_branch_id = p_country_branch_id or r.country_branch_id is null)
    and r.rate_date <= v_date
  order by r.rate_date desc, (case when r.country_branch_id is not null then 1 else 0 end) desc
  limit 1;
end;
$$;

do $sec$
begin
  grant execute on function public.get_branch_cash_summary(uuid, uuid, text) to authenticated, anon, service_role;
  grant execute on function public.get_daily_rate(uuid, uuid, text) to authenticated, anon, service_role;
end;
$sec$;
