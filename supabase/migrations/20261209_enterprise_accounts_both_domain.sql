-- Shared Business + Shipping account: one Account Master row usable by both operational
-- domains. Additive constraint widening only; no data change.
ALTER TABLE public.enterprise_accounts DROP CONSTRAINT IF EXISTS enterprise_accounts_operational_domain_check;
ALTER TABLE public.enterprise_accounts
  ADD CONSTRAINT enterprise_accounts_operational_domain_check
  CHECK (operational_domain = ANY (ARRAY['business'::text, 'shipping'::text, 'both'::text]));
