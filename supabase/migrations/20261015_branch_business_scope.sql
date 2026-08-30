-- Migration: 20261015_branch_business_scope.sql
-- Business vs agent/logistics branch separation.
--
-- Normal business transaction modules (Purchase, Sales, Local Purchase, Local Sales,
-- Accounting, Ledger, Roznamcha, Cash/Bank Entry, Settlement, Bill Expenses) must only
-- ever see / accept BUSINESS city branches. Shipping-Line / Clearing-Agent / logistics
-- branches must not appear in the business Country → Main Branch → City Branch selector,
-- and must be rejected by the business APIs even if an id is passed directly.
--
-- `city_branches.is_business_branch` is the single DB source of truth for that. A branch
-- that serves BOTH roles (business + a linked clearing-agent branch) stays business —
-- its agent role is already expressed through `clearing_agent_branches`. Only a branch
-- that is purely an agent/logistics operational branch (linked to an agent/shipping
-- record AND with zero business activity of its own) is flipped off here.
--
-- Additive & idempotent. No data is deleted.

BEGIN;

ALTER TABLE public.city_branches
  ADD COLUMN IF NOT EXISTS is_business_branch boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.city_branches.is_business_branch IS
  'true = usable in business transaction modules (Purchase/Sales/Ledger/Roznamcha/...). '
  'false = agent/shipping/logistics-only branch, hidden & rejected in business modules.';

-- Back-fill: flip OFF only genuinely agent-only branches.
UPDATE public.city_branches cb
   SET is_business_branch = false
 WHERE cb.deleted_at IS NULL
   AND cb.is_business_branch = true
   AND EXISTS (
        SELECT 1 FROM public.clearing_agent_branches ca
         WHERE ca.city_branch_id = cb.id AND ca.deleted_at IS NULL
       )
   AND NOT EXISTS (SELECT 1 FROM public.purchase_orders  p WHERE p.city_branch_id = cb.id AND p.deleted_at IS NULL)
   AND NOT EXISTS (SELECT 1 FROM public.sales_orders     s WHERE s.city_branch_id = cb.id AND s.deleted_at IS NULL)
   AND NOT EXISTS (SELECT 1 FROM public.local_purchases  l WHERE l.city_branch_id = cb.id AND l.deleted_at IS NULL)
   AND NOT EXISTS (SELECT 1 FROM public.roznamcha_entries r WHERE r.city_branch_id = cb.id AND r.deleted_at IS NULL)
   AND NOT EXISTS (SELECT 1 FROM public.enterprise_accounts e WHERE e.city_branch_id = cb.id AND e.deleted_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_city_branches_business
  ON public.city_branches (country_id, is_business_branch) WHERE deleted_at IS NULL;

INSERT INTO public.erp_schema_migrations (name, status)
VALUES ('20261015_branch_business_scope', 'applied')
ON CONFLICT (name) DO UPDATE SET status = 'applied', applied_at = now();

COMMIT;

NOTIFY pgrst, 'reload schema';
