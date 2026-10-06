-- Profit & Loss and Balance Sheet reporting functions.
--
-- CLAUDE.md Master Requirement Section A: Trial Balance and Receivables/
-- Payables aging already existed (get_trial_balance, ledger_outstanding_v);
-- Profit & Loss, Balance Sheet, and Cash Flow did not. This migration adds
-- exactly one new function, get_financial_statement_ledgers, that returns
-- per-ledger opening/period/closing figures PLUS the account `kind`
-- (asset/liability/income/expense/equity from enterprise_accounts) in one
-- row-set -- the API layer classifies rows into P&L (income/expense over
-- the period) or Balance Sheet (asset/liability/equity as of the end date)
-- sections, exactly the same way app/api/erp/accounting/reports/
-- trial-balance/route.ts already sums get_trial_balance's rows into
-- debit/credit totals. No second ledger/accounting engine, no new scoping
-- mechanism: reuses assert_enterprise_scope_access and
-- enterprise_scope_matches verbatim, and the same ledgers/ledger_balances
-- tables get_trial_balance already reads.
--
-- Cash Flow Statement is intentionally NOT a new SQL function: an accurate
-- indirect-method cash flow needs each account tagged Operating/Investing/
-- Financing, which nothing in this schema currently records (see the
-- capability audit). Fabricating that classification would produce a
-- misleading "Cash Flow Statement". Instead, the cash-flow API route
-- reports an honest, real, direct-method "Cash & Bank Position" -- opening
-- vs closing balance of every enterprise_accounts row with a non-null
-- bank_id (bank-linked accounts, an existing real column) or whose kind is
-- an asset ledger commonly used for cash -- clearly labeled as a cash/bank
-- movement summary, not a fabricated 3-way indirect P&L reconciliation.

CREATE OR REPLACE FUNCTION public.get_financial_statement_ledgers(
  p_scope ledger_scope,
  p_country_id uuid,
  p_country_branch_id uuid,
  p_city_branch_id uuid,
  p_from_date date,
  p_to_date date
)
 RETURNS TABLE(
   ledger_id uuid,
   parent_ledger_id uuid,
   code text,
   name text,
   currency text,
   kind text,
   opening_balance numeric,
   period_debit numeric,
   period_credit numeric,
   closing_balance numeric
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with allowed as (
    select assert_enterprise_scope_access(p_scope, p_country_id, p_country_branch_id, p_city_branch_id)
  ),
  scoped_ledgers as (
    select l.*, ea.kind::text as account_kind
    from ledgers l
    left join enterprise_accounts ea on ea.id = l.enterprise_account_id
    where l.deleted_at is null
      and enterprise_scope_matches(
        p_scope,
        p_country_id,
        p_country_branch_id,
        p_city_branch_id,
        l.scope,
        l.country_id,
        l.country_branch_id,
        l.city_branch_id
      )
  ),
  -- Opening = whatever the ledger's balance was immediately before p_from_date
  -- (ledger.opening_balance + all movement strictly before the period start).
  pre_period as (
    select lb.ledger_id, sum(lb.debit_total) as debit_total, sum(lb.credit_total) as credit_total
    from ledger_balances lb
    where lb.balance_date < p_from_date
    group by lb.ledger_id
  ),
  in_period as (
    select lb.ledger_id, sum(lb.debit_total) as debit_total, sum(lb.credit_total) as credit_total
    from ledger_balances lb
    where lb.balance_date >= p_from_date and lb.balance_date <= p_to_date
    group by lb.ledger_id
  )
  select
    sl.id,
    sl.parent_ledger_id,
    sl.code,
    sl.name,
    sl.currency,
    coalesce(sl.account_kind, 'unclassified'),
    sl.opening_balance + coalesce(pp.debit_total, 0) - coalesce(pp.credit_total, 0) as opening_balance,
    coalesce(ip.debit_total, 0) as period_debit,
    coalesce(ip.credit_total, 0) as period_credit,
    sl.opening_balance
      + coalesce(pp.debit_total, 0) - coalesce(pp.credit_total, 0)
      + coalesce(ip.debit_total, 0) - coalesce(ip.credit_total, 0) as closing_balance
  from scoped_ledgers sl
  cross join allowed
  left join pre_period pp on pp.ledger_id = sl.id
  left join in_period ip on ip.ledger_id = sl.id
  order by sl.code;
$function$
;

notify pgrst, 'reload schema';
